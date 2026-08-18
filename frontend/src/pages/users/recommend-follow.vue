<template>
  <PageShell
    title="认识一些乡音"
    :show-back="false"
  >
    <view class="intro-card">
      <view class="step-mark">
        方言身份 · 下一步
      </view>
      <view class="intro-title">
        让关注流从乡音开始
      </view>
      <view class="intro-copy">
        主方言已经自动关注。你也可以订阅别的方言，或认识几位真正上传过公开罐头的作者。
      </view>
      <view
        v-if="primaryDialect"
        class="primary-badge"
      >
        主方言 · {{ primaryDialect.qualified_code || primaryDialect.name }}
      </view>
    </view>

    <view class="section-card">
      <view class="section-kicker">
        关注方言
      </view>
      <view class="section-title">
        还想听哪些地方的乡音？
      </view>
      <view
        v-if="loading"
        class="loading-copy"
      >
        正在读取真实方言树…
      </view>
      <scroll-view
        v-else
        scroll-y
        class="dialect-list"
      >
        <view
          v-for="dialect in dialects"
          :key="dialect.id"
          :class="['dialect-row', isDialectSelected(dialect.id) ? 'selected' : '']"
          :style="dialectIndent(dialect)"
          @tap="toggleDialect(dialect.id)"
        >
          <view class="choice-mark">
            {{ isDialectSelected(dialect.id) ? '●' : '○' }}
          </view>
          <view class="dialect-copy">
            <view class="dialect-name">
              {{ dialect.name }}
            </view>
            <view class="dialect-code">
              {{ dialect.qualified_code }}
            </view>
          </view>
          <view
            v-if="dialect.id === primaryDialect?.id"
            class="locked-mark"
          >
            主方言
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section-card creator-section">
      <view class="section-kicker">
        真实贡献者
      </view>
      <view class="section-title">
        同方言作者
      </view>
      <view class="section-hint">
        只推荐有公开罐头的真实用户，不足时不会用演示账号补位。
      </view>
      <view
        v-if="!loading && !candidates.length"
        class="empty-copy"
      >
        暂时没有可推荐的同方言作者。主方言订阅已经生效，可以直接进入首页。
      </view>
      <view
        v-for="candidate in candidates"
        :key="candidate.id"
        :class="['creator-row', isAuthorSelected(candidate.id) ? 'selected' : '']"
        @tap="toggleAuthor(candidate.id)"
      >
        <image
          class="creator-avatar"
          :src="candidate.avatar"
          mode="aspectFill"
        />
        <view class="creator-copy">
          <view class="creator-name">
            {{ candidate.nickname || candidate.username }}
          </view>
          <view class="creator-meta">
            {{ candidate.primary_dialect?.qualified_code }} · {{ candidate.public_can_count }} 罐公开乡音
          </view>
        </view>
        <view class="creator-check">
          {{ isAuthorSelected(candidate.id) ? '已选' : '选择' }}
        </view>
      </view>
    </view>

    <view class="actions">
      <button
        class="secondary-button"
        :disabled="saving"
        @tap="skip"
      >
        暂时跳过
      </button>
      <button
        class="primary-button"
        :disabled="saving"
        @tap="save"
      >
        {{ saving ? '正在保存…' : actionText }}
      </button>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import { goOnboarding } from '@/services/navigation';
import { toIndexPage } from '@/routers';
import {
  followDialect,
  followUser,
  listFollowRecommendations,
  unfollowDialect,
} from '@/services/following';
import { listAllDialects } from '@/services/guantou';

export default {
  components: { PageShell },
  data() {
    const user = getApp().globalData.userInfo || {};
    const followedIds = (user.followed_dialects || []).map((item) => item.id);
    if (user.primary_dialect?.id && !followedIds.includes(user.primary_dialect.id)) {
      followedIds.push(user.primary_dialect.id);
    }
    return {
      candidates: [],
      dialects: [],
      initialDialectIds: [...followedIds],
      loading: true,
      primaryDialect: user.primary_dialect || null,
      saving: false,
      selectedAuthorIds: [],
      selectedDialectIds: [...followedIds],
    };
  },
  computed: {
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
    try {
      const [dialects, response] = await Promise.all([
        listAllDialects(),
        listFollowRecommendations(this.primaryDialect.id),
      ]);
      this.dialects = dialects;
      this.candidates = response.results || [];
      this.selectedAuthorIds = this.candidates.slice(0, 3).map((item) => item.id);
    } catch (error) {
      uni.showToast({ title: '推荐暂时加载失败，可以直接进入首页', icon: 'none' });
    } finally {
      this.loading = false;
    }
  },
  methods: {
    dialectIndent(dialect) {
      return { paddingLeft: `${20 + Number(dialect.depth || 0) * 20}rpx` };
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
      toIndexPage(true);
    },
    skip() {
      toIndexPage(true);
    },
  },
};
</script>

<style scoped>
.intro-card,
.section-card {
  border: 1px solid #dce5d8;
  border-radius: 18rpx;
  background: #fff;
  padding: 28rpx;
}

.section-card {
  margin-top: 22rpx;
}

.step-mark,
.section-kicker {
  color: #885331;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.intro-title {
  margin-top: 14rpx;
  font-size: 44rpx;
  font-weight: 900;
}

.section-title {
  margin-top: 10rpx;
  font-size: 32rpx;
  font-weight: 850;
}

.intro-copy,
.section-hint,
.loading-copy,
.empty-copy {
  margin-top: 12rpx;
  color: #607067;
  font-size: 25rpx;
  line-height: 1.6;
}

.primary-badge {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 9rpx 18rpx;
  border-radius: 999rpx;
  background: #e9f2e8;
  color: #1f6549;
  font-size: 24rpx;
  font-weight: 800;
}

.dialect-list {
  height: 410rpx;
  margin-top: 18rpx;
  border-top: 1px solid #edf0e9;
}

.dialect-row,
.creator-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 86rpx;
  border-bottom: 1px solid #edf0e9;
  box-sizing: border-box;
}

.dialect-row.selected,
.creator-row.selected {
  background: #f0f6ed;
}

.choice-mark {
  color: #1f6549;
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
  color: #7a867d;
  font-size: 22rpx;
  overflow-wrap: anywhere;
}

.locked-mark,
.creator-check {
  flex: 0 0 auto;
  color: #1f6549;
  font-size: 22rpx;
  font-weight: 800;
}

.creator-section {
  margin-bottom: 26rpx;
}

.creator-avatar {
  width: 74rpx;
  height: 74rpx;
  border-radius: 50%;
  background: #e6ebe3;
}

.actions {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr;
  gap: 14rpx;
  padding-bottom: 34rpx;
}

.primary-button,
.secondary-button {
  width: 100%;
  margin: 0;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.primary-button {
  background: #1f6549;
  color: #fff;
}

.secondary-button {
  border: 1px solid #cfd9cc;
  background: #fff;
  color: #315b49;
}

.primary-button::after,
.secondary-button::after {
  border: 0;
}
</style>
