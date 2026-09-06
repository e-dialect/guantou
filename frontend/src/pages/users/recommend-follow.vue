<template>
  <PageShell
    title="认识一些乡音"
    :show-back="false"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="身份设置已完成"
      mark="听"
      title="让关注流从乡音开始"
      lead="主方言已经自动关注。再选一些地区或真实贡献者，就能听见更贴近你的乡音。"
    >
      <template #hero>
        <view
          v-if="primaryDialect"
          class="primary-badge"
        >
          主方言 · {{ dialectCardLabel(primaryDialect, dialects) }}
        </view>
      </template>

      <view
        v-if="loading"
        class="loading-shell"
      >
        <BaseLoading text="正在读取方言与作者…" />
      </view>
      <EmptyState
        v-else-if="loadError"
        title="推荐加载失败"
        description="方言和作者推荐没有读出来。重试一次，或直接进入首页——主方言订阅已生效。"
        action-text="重新加载"
        @action="loadRecommendations"
      />
      <template v-else>
        <view class="follow-section">
          <view class="section-kicker">
            关注方言
          </view>
          <view class="section-title">
            还想听哪些地方的乡音？
          </view>
          <view class="followed-dialects">
            <view
              v-for="dialect in selectedDialects"
              :key="dialect.id"
              class="dialect-row selected"
              @tap="toggleDialect(dialect.id)"
            >
              <view class="choice-mark">
                ●
              </view>
              <view class="dialect-copy">
                <view class="dialect-name">
                  {{ dialectCardLabel(dialect, dialects) }}
                </view>
                <view class="dialect-path">
                  {{ dialectBreadcrumb(dialect, dialects) }}
                </view>
              </view>
              <view
                v-if="dialect.id === primaryDialect?.id"
                class="locked-mark"
              >
                主方言
              </view>
              <view
                v-else
                class="locked-mark"
              >
                移除
              </view>
            </view>
            <BaseButton
              block
              variant="ghost"
              text="逐级添加关注地区"
              @click="dialectPickerOpen = true"
            />
          </view>
        </view>

        <DialectSelector
          v-model:visible="dialectPickerOpen"
          :dialects="dialects"
          :default-dialect="primaryDialect"
          :owner-scope="ownerScope"
          title="添加关注地区"
          @change="addDialect"
        />

        <view class="follow-section creator-section">
          <view class="section-kicker">
            真实贡献者
          </view>
          <view class="section-title">
            同方言作者
          </view>
          <view class="section-hint">
            只推荐有公开录音的真实用户，不足时不会用演示账号补位。
          </view>
          <EmptyState
            v-if="!candidates.length"
            title="暂时没有可推荐的同方言作者"
            description="主方言订阅已经生效，可以直接进入首页认识更多乡音。"
            action-text="进入首页"
            @action="skip"
          />
          <view
            v-for="candidate in candidates"
            :key="candidate.id"
            :class="['creator-row', isAuthorSelected(candidate.id) ? 'selected' : '']"
            @tap="toggleAuthor(candidate.id)"
          >
            <image
              v-if="candidate.avatar"
              class="creator-avatar"
              :src="candidate.avatar"
              mode="aspectFill"
            />
            <view
              v-else
              class="creator-avatar creator-avatar--fallback"
              aria-hidden="true"
            >
              {{ authorMark(candidate) }}
            </view>
            <view class="creator-copy">
              <view class="creator-name">
                {{ candidate.nickname || candidate.username }}
              </view>
              <view class="creator-meta">
                {{ dialectCardLabel(candidate.primary_dialect, dialects) }}
                · {{ candidate.public_recording_count }} 段公开乡音
              </view>
            </view>
            <view class="creator-check">
              {{ isAuthorSelected(candidate.id) ? '已选' : '选择' }}
            </view>
          </view>
        </view>
      </template>

      <view class="actions">
        <BaseButton
          block
          variant="ghost"
          :disabled="saving"
          @click="skip"
        >
          暂时跳过
        </BaseButton>
        <BaseButton
          block
          :disabled="saving"
          @click="save"
        >
          {{ saving ? '正在保存…' : actionText }}
        </BaseButton>
      </view>
    </AuthJourney>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import { goOnboarding } from '@/services/navigation';
import { toIndexPage } from '@/routers';
import {
  followDialect,
  followUser,
  listFollowRecommendations,
  unfollowDialect,
} from '@/services/following';
import { listAllDialects } from '@/services/guantou';
import { dialectBreadcrumb, dialectCardLabel } from '@/utils/dialectTree';

export default {
  components: {
    AuthJourney, PageShell, BaseButton, BaseLoading, DialectSelector, EmptyState,
  },
  data() {
    const user = getApp().globalData.userInfo || {};
    const followedIds = (user.followed_dialects || []).map((item) => item.id);
    if (user.primary_dialect?.id && !followedIds.includes(user.primary_dialect.id)) {
      followedIds.push(user.primary_dialect.id);
    }
    return {
      candidates: [],
      dialects: [],
      dialectPickerOpen: false,
      initialDialectIds: [...followedIds],
      loadError: false,
      loading: true,
      primaryDialect: user.primary_dialect || null,
      saving: false,
      selectedAuthorIds: [],
      selectedDialectIds: [...followedIds],
    };
  },
  computed: {
    ownerScope() {
      return getApp().globalData.userInfo?.id || 'guest';
    },
    selectedDialects() {
      return this.selectedDialectIds
        .map((id) => this.dialects.find((item) => item.id === id))
        .filter(Boolean);
    },
    actionText() {
      const total = this.selectedAuthorIds.length;
      return total ? `关注已选作者（${total}）` : '进入首页';
    },
  },
  async onLoad() {
    if (!this.primaryDialect?.id) {
      goOnboarding({ reason: 'missing_dialect' }, { reset: true });
      return;
    }
    await this.loadRecommendations();
  },
  methods: {
    dialectBreadcrumb,
    dialectCardLabel,
    authorMark(candidate = {}) {
      const label = String(candidate.nickname || candidate.username || '乡').trim();
      return label.slice(0, 1) || '乡';
    },
    async loadRecommendations() {
      this.loading = true;
      this.loadError = false;
      try {
        const [dialects, response] = await Promise.all([
          listAllDialects(),
          listFollowRecommendations(this.primaryDialect.id),
        ]);
        this.dialects = dialects;
        this.candidates = response.results || [];
        this.selectedAuthorIds = this.candidates.slice(0, 3).map((item) => item.id);
      } catch (error) {
        this.loadError = true;
      } finally {
        this.loading = false;
      }
    },
    addDialect({ value }) {
      const id = Number(value);
      if (!id || this.isDialectSelected(id)) return;
      this.selectedDialectIds = [...this.selectedDialectIds, id];
    },
    isDialectSelected(id) {
      return this.selectedDialectIds.includes(id);
    },
    isAuthorSelected(id) {
      return this.selectedAuthorIds.includes(id);
    },
    toggleDialect(id) {
      if (id === this.primaryDialect?.id) {
        uni.showToast({ title: '主方言会始终保持关注', icon: 'none' });
        return;
      }
      this.selectedDialectIds = this.isDialectSelected(id)
        ? this.selectedDialectIds.filter((item) => item !== id)
        : [...this.selectedDialectIds, id];
    },
    toggleAuthor(id) {
      this.selectedAuthorIds = this.isAuthorSelected(id)
        ? this.selectedAuthorIds.filter((item) => item !== id)
        : [...this.selectedAuthorIds, id];
    },
    async save() {
      if (this.saving) return;
      this.saving = true;
      const addedDialects = this.selectedDialectIds.filter(
        (id) => !this.initialDialectIds.includes(id),
      );
      const removedDialects = this.initialDialectIds.filter(
        (id) => id !== this.primaryDialect?.id && !this.selectedDialectIds.includes(id),
      );
      const jobs = [
        ...addedDialects.map((id) => ({ id, type: 'add-dialect', run: () => followDialect(id) })),
        ...removedDialects.map((id) => ({ id, type: 'remove-dialect', run: () => unfollowDialect(id) })),
        ...this.selectedAuthorIds.map((id) => ({ id, type: 'follow-user', run: () => followUser(id) })),
      ];
      const results = await Promise.allSettled(jobs.map((job) => job.run()));
      const failed = results.filter((result) => result.status === 'rejected').length;
      const user = getApp().globalData.userInfo;
      if (user) {
        const followed = new Map((user.followed_dialects || []).map((item) => [item.id, item]));
        jobs.forEach((job, index) => {
          if (results[index].status === 'rejected') return;
          if (job.type === 'add-dialect') {
            const dialect = this.dialects.find((item) => item.id === job.id);
            if (dialect) followed.set(job.id, dialect);
          } else if (job.type === 'remove-dialect') {
            followed.delete(job.id);
          }
        });
        user.followed_dialects = [...followed.values()];
      }
      uni.showToast({
        title: failed ? `${jobs.length - failed} 项已保存，${failed} 项失败` : '关注已保存',
        icon: failed ? 'none' : 'success',
      });
      toIndexPage(true, { tab: 'today' });
    },
    skip() {
      toIndexPage(true, { tab: 'today' });
    },
  },
};
</script>

<style scoped>
.section-kicker {
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.section-title {
  margin-top: 10rpx;
  font-size: 32rpx;
  font-weight: 800;
}

.section-hint {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  font-size: 25rpx;
  line-height: 1.6;
}

/* 加载占位与方言列表高度对齐，避免加载完成后布局跳动 */
.loading-shell {
  min-height: 410rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-badge {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 9rpx 18rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-color);
  color: var(--immersive-accent-color);
  font-size: 24rpx;
  font-weight: 800;
}

.follow-section + .follow-section {
  margin-top: 30rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid var(--border-color);
}

.dialect-list {
  height: 410rpx;
  margin-top: 18rpx;
  border-top: 1rpx solid var(--border-color);
}

.dialect-row,
.creator-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 86rpx;
  border-bottom: 1rpx solid var(--border-color);
  box-sizing: border-box;
  transition: background-color 0.2s ease;
}

.dialect-row:active,
.creator-row:active {
  background: var(--surface-subtle-color);
}

.dialect-row.selected,
.creator-row.selected {
  background: var(--accent-subtle-color);
}

/* 已选中的行按下时加深，保证按压反馈不被选中态覆盖 */
.dialect-row.selected:active,
.creator-row.selected:active {
  background: var(--border-color);
}

@media (prefers-reduced-motion: reduce) {
  .dialect-row,
  .creator-row {
    transition: none;
  }
}

.choice-mark {
  color: var(--accent-color);
  font-size: 25rpx;
}

.dialect-copy,
.creator-copy {
  min-width: 0;
  flex: 1;
}

.dialect-name,
.creator-name {
  font-size: 28rpx;
  font-weight: 800;
}

.dialect-code,
.creator-meta {
  margin-top: 5rpx;
  color: var(--muted-color);
  font-size: 22rpx;
  overflow-wrap: anywhere;
}

.locked-mark,
.creator-check {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 800;
}

.creator-section {
  margin-bottom: 26rpx;
}

.creator-avatar {
  flex: 0 0 auto;
  width: 74rpx;
  height: 74rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 50%;
  background: var(--surface-subtle-color);
  box-sizing: border-box;
}

.creator-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-color);
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: 30rpx;
  font-weight: 900;
}

.actions {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr;
  gap: 14rpx;
  margin-top: 30rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid var(--border-color);
}
</style>
