<template>
  <PageShell
    :title="pageTitle"
    :back-fallback="ROUTES.home"
  >
    <view
      v-if="loading"
      class="state-card"
    >
      正在读取用户档案…
    </view>
    <view
      v-else-if="loadError"
      class="state-card"
    >
      <view>{{ loadError }}</view>
      <BaseButton
        class="state-action"
        block
        @click="getInfo"
      >
        重试
      </BaseButton>
    </view>
    <template v-else>
      <view class="hero">
        <image
          class="avatar"
          :src="userInfo.user.avatar"
          mode="aspectFill"
        />
        <view class="hero-copy">
          <view class="name">
            {{ userInfo.user.nickname || userInfo.user.username }}
          </view>
          <view class="handle">
            乡声号 {{ userInfo.user.username || '未设置' }}
          </view>
          <view class="bio">
            {{ bioText }}
          </view>
          <view class="meta-row">
            <view
              v-if="userInfo.user.primary_dialect"
              class="dialect-badge"
            >
              {{ locationText }}
            </view>
            <view
              v-else
              class="meta"
            >
              未填写方言点
            </view>
            <view
              v-if="titleLabel"
              class="title-badge"
            >
              {{ titleLabel }}
            </view>
          </view>
        </view>
      </view>

      <view class="social-stats">
        <view class="social-stat">
          <view class="number">
            {{ displayCansCount }}
          </view>
          <view class="label">
            罐头
          </view>
        </view>
        <view class="social-stat">
          <view class="number">
            {{ userInfo.user.following_count }}
          </view>
          <view class="label">
            关注
          </view>
        </view>
        <view class="social-stat">
          <view class="number">
            {{ userInfo.user.follower_count }}
          </view>
          <view class="label">
            粉丝
          </view>
        </view>
      </view>

      <view
        v-if="isSelf"
        class="profile-actions"
      >
        <view class="action-slot">
          <BaseButton
            variant="ghost"
            size="small"
            block
            @click="goUserInformation"
          >
            编辑资料
          </BaseButton>
        </view>
        <view class="action-slot">
          <BaseButton
            variant="ghost"
            size="small"
            block
            @click="goMails"
          >
            消息
          </BaseButton>
        </view>
        <view class="action-slot">
          <BaseButton
            size="small"
            block
            @click="goCreateCan"
          >
            装一罐
          </BaseButton>
        </view>
      </view>
      <view
        v-else
        class="profile-actions"
      >
        <view class="action-slot">
          <BaseButton
            block
            size="small"
            :variant="userInfo.user.is_following ? 'ghost' : 'primary'"
            :disabled="followingBusy"
            :loading="followingBusy"
            @click="toggleFollow"
          >
            {{ userInfo.user.is_following ? '已关注' : '关注' }}
          </BaseButton>
        </view>
        <view class="action-slot">
          <BaseButton
            variant="ghost"
            size="small"
            block
            @click="openMail"
          >
            私信
          </BaseButton>
        </view>
      </view>

      <view class="works">
        <view class="works-tabs">
          <view
            class="works-tab pressable"
            :class="{ active: worksTab === 'cans' }"
            @tap="worksTab = 'cans'"
          >
            罐头 {{ displayCansCount }}
          </view>
          <view
            class="works-tab pressable"
            :class="{ active: worksTab === 'nameplates' }"
            @tap="worksTab = 'nameplates'"
          >
            铭牌 {{ displayNameplatesCount }}
          </view>
          <view
            class="works-tab pressable"
            :class="{ active: worksTab === 'flavors' }"
            @tap="worksTab = 'flavors'"
          >
            义项 {{ displayFlavorsCount }}
          </view>
        </view>
        <view class="works-empty">
          <view class="works-empty-title">
            {{ worksPanelTitle }}
          </view>
          <view class="works-empty-copy">
            {{ worksPanelCopy }}
          </view>
          <BaseButton
            v-if="isSelf && worksCount === 0 && worksTab === 'cans'"
            class="works-empty-action"
            block
            @click="goCreateCan"
          >
            去装一罐
          </BaseButton>
          <BaseButton
            v-else-if="isSelf"
            class="works-empty-action"
            variant="ghost"
            block
            @click="goCanLibrary"
          >
            打开罐头库
          </BaseButton>
          <BaseButton
            v-else
            class="works-empty-action"
            variant="ghost"
            block
            @click="goHome"
          >
            先去听罐头
          </BaseButton>
        </view>
      </view>
    </template>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import PageShell from '@/components/PageShell.vue';
import { APP_NAME } from '@/const/branding';
import { requireAuth } from '@/services/authGuard';
import { followUser, unfollowUser } from '@/services/following';
import {
  goCanLibrary,
  goCreateCan,
  goHome,
  goMailSend,
  goMails,
  goUserInformation,
  ROUTES,
} from '@/services/navigation';
import { defaultMessage } from '@/services/shareMessages';
import { getUserInfo } from '@/services/user';

export default {
  components: { BaseButton, PageShell },
  data() {
    return {
      ROUTES,
      id: 0,
      loading: true,
      loadError: '',
      userInfo: {
        user: {
          avatar: '',
          nickname: '',
          username: '',
          primary_dialect: null,
          follower_count: 0,
          following_count: 0,
          is_following: false,
          title: { title: '' },
        },
        contribution: {
          cans: 0,
          flavors: 0,
          nameplates: 0,
        },
      },
      followingBusy: false,
      worksTab: 'cans',
    };
  },
  computed: {
    locationText() {
      return this.userInfo.user.primary_dialect?.qualified_code || '未填写方言点';
    },
    pageTitle() {
      return this.userInfo.user.nickname
        || this.userInfo.user.username
        || '用户档案';
    },
    titleLabel() {
      return this.userInfo.user.title?.title || '';
    },
    bioText() {
      const dialect = this.locationText;
      if (this.titleLabel) return `${this.titleLabel} · ${dialect}`;
      return `在「${dialect}」装罐`;
    },
    isSelf() {
      const mine = Number(uni.getStorageSync('id'));
      const theirs = Number(this.id);
      return Boolean(mine) && mine === theirs;
    },
    displayCansCount() {
      return this.contributionCount('cans');
    },
    displayFlavorsCount() {
      return this.contributionCount('flavors');
    },
    displayNameplatesCount() {
      return this.contributionCount('nameplates');
    },
    worksCount() {
      return this.contributionCount(this.worksTab);
    },
    worksPanelTitle() {
      if (this.worksCount > 0) {
        if (this.worksTab === 'nameplates') return `已有 ${this.worksCount} 张铭牌`;
        if (this.worksTab === 'flavors') return `已有 ${this.worksCount} 个义项`;
        return `已有 ${this.worksCount} 罐`;
      }
      if (this.worksTab === 'nameplates') {
        return this.isSelf ? '还没有贴铭牌' : '还没有公开铭牌';
      }
      if (this.worksTab === 'flavors') {
        return this.isSelf ? '还没有提交义项' : '还没有公开义项';
      }
      return this.isSelf ? '还没有装罐' : '还没有公开罐头';
    },
    worksPanelCopy() {
      if (this.worksCount > 0) {
        return this.isSelf
          ? '完整列表在罐头库，可按录制、收藏和草稿查看。'
          : '主页展示贡献数量。他们装过的罐头会出现在罐头详情和搜索结果里。';
      }
      if (this.worksTab === 'nameplates') {
        return this.isSelf
          ? '铭牌是对某条罐头的写法、释义和出处主张。先听一罐再去贴。'
          : 'TA 还没有公开铭牌。先去听推荐，或者稍后再来看看。';
      }
      if (this.worksTab === 'flavors') {
        return this.isSelf
          ? '义项用来收纳“同一个意思在各地怎么说”。去罐头库看看别人怎么装。'
          : 'TA 还没有公开义项。先去听推荐，或者稍后再来看看。';
      }
      return this.isSelf
        ? '罐头是一段乡音录音。装罐后会出现在主页数量和罐头库里。'
        : 'TA 还没有公开罐头。先去听推荐，或者稍后再来看看。';
    },
  },
  async onLoad(options) {
    this.id = options.id;
    await this.getInfo();
  },
  onShareAppMessage() {
    return {
      title: `${this.pageTitle} · ${APP_NAME}`,
      path: `${ROUTES.userDetail}?id=${this.id}`,
      ...defaultMessage(),
    };
  },
  methods: {
    goUserInformation,
    goCreateCan,
    goMails,
    goHome,
    goCanLibrary,
    openMail() {
      if (!requireAuth('dm', { page: 'user_detail', userId: this.id })) return;
      goMailSend(this.id);
    },
    contributionCount(kind) {
      const contribution = this.userInfo.contribution || {};
      if (this.isSelf) {
        if (kind === 'nameplates') {
          return contribution.nameplates_uploaded ?? contribution.nameplates ?? 0;
        }
        if (kind === 'flavors') {
          return contribution.flavors_uploaded ?? contribution.flavors ?? 0;
        }
        return contribution.cans_uploaded ?? contribution.cans ?? 0;
      }
      if (kind === 'nameplates') return contribution.nameplates ?? 0;
      if (kind === 'flavors') return contribution.flavors ?? 0;
      return contribution.cans ?? 0;
    },
    async getInfo() {
      if (!this.id) {
        this.loading = false;
        this.loadError = '缺少用户编号，请从主页或搜索再打开一次';
        return;
      }
      this.loading = true;
      this.loadError = '';
      try {
        this.userInfo = await getUserInfo(this.id, true);
      } catch (error) {
        this.loadError = error?.message || '用户档案加载失败，请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
    async toggleFollow() {
      if (!requireAuth('follow', { page: 'user_detail', userId: this.id })) return;
      if (this.followingBusy) return;
      this.followingBusy = true;
      const wasFollowing = this.userInfo.user.is_following;
      try {
        if (wasFollowing) {
          await unfollowUser(this.id);
        } else {
          await followUser(this.id);
        }
        this.userInfo.user.is_following = !wasFollowing;
        this.userInfo.user.follower_count = Math.max(
          0,
          Number(this.userInfo.user.follower_count || 0) + (wasFollowing ? -1 : 1),
        );
      } catch {
        return;
      } finally {
        this.followingBusy = false;
      }
    },
  },
};
</script>

<style scoped>
.state-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-secondary-color);
}

.state-action {
  margin-top: var(--space-3);
}

.hero {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.avatar {
  width: 168rpx;
  height: 168rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  flex-shrink: 0;
}

.name {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.handle,
.bio,
.meta {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.bio {
  line-height: 1.5;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.dialect-badge,
.title-badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.dialect-badge {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.title-badge {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.social-stats {
  display: flex;
  margin-top: var(--space-4);
}

.social-stat {
  flex: 1;
}

.number {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.label {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.profile-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.action-slot {
  flex: 1;
  min-width: 0;
}

.works {
  margin-top: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  overflow: hidden;
}

.works-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.works-tab {
  flex: 1;
  padding: var(--space-3) 0;
  text-align: center;
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.works-tab.active {
  color: var(--text-color);
  font-weight: 700;
  box-shadow: inset 0 -4rpx 0 var(--accent-color);
}

.works-empty {
  padding: var(--space-5) var(--space-3);
  text-align: center;
}

.works-empty-title {
  font-weight: 700;
}

.works-empty-copy {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.works-empty-action {
  margin-top: var(--space-3);
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
