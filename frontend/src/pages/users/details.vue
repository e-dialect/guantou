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
          </view>
        </view>
      </view>

      <view class="social-stats">
        <view class="social-stat">
          <view class="number">
            {{ displayRecordingsCount }}
          </view>
          <view class="label">
            录音
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
            @click="goRecord"
          >
            录乡音
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
            :class="{ active: worksTab === 'recordings' }"
            @tap="worksTab = 'recordings'"
          >
            录音 {{ displayRecordingsCount }}
          </view>
          <view
            class="works-tab pressable"
            :class="{ active: worksTab === 'entries' }"
            @tap="worksTab = 'entries'"
          >
            词条 {{ displayEntriesCount }}
          </view>
          <view
            class="works-tab pressable"
            :class="{ active: worksTab === 'senses' }"
            @tap="worksTab = 'senses'"
          >
            义项 {{ displaySensesCount }}
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
            v-if="isSelf && worksCount === 0 && worksTab === 'recordings'"
            class="works-empty-action"
            block
            @click="goRecord"
          >
            去录乡音
          </BaseButton>
          <BaseButton
            v-else-if="isSelf"
            class="works-empty-action"
            variant="ghost"
            block
            @click="goContributionHistory"
          >
            查看贡献履历
          </BaseButton>
          <BaseButton
            v-else
            class="works-empty-action"
            variant="ghost"
            block
            @click="goHome"
          >
            先去听乡音
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
  goContributionHistory,
  goHome,
  goMailSend,
  goMails,
  goRecord,
  goUserInformation,
  ROUTES,
} from '@/services/navigation';
import { defaultMessage } from '@/services/shareMessages';
import { getUserInfo } from '@/services/user';
import { dialectCardLabel } from '@/utils/dialectTree';

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
        },
        contribution: {
          recordings: 0,
          senses: 0,
          entries: 0,
        },
      },
      followingBusy: false,
      worksTab: 'recordings',
    };
  },
  computed: {
    locationText() {
      return dialectCardLabel(this.userInfo.user.primary_dialect);
    },
    pageTitle() {
      return this.userInfo.user.nickname
        || this.userInfo.user.username
        || '用户档案';
    },
    bioText() {
      const dialect = this.locationText;
      return `在「${dialect}」记录乡音`;
    },
    isSelf() {
      const mine = Number(uni.getStorageSync('id'));
      const theirs = Number(this.id);
      return Boolean(mine) && mine === theirs;
    },
    displayRecordingsCount() {
      return this.contributionCount('recordings');
    },
    displaySensesCount() {
      return this.contributionCount('senses');
    },
    displayEntriesCount() {
      return this.contributionCount('entries');
    },
    worksCount() {
      return this.contributionCount(this.worksTab);
    },
    worksPanelTitle() {
      if (this.worksCount > 0) {
        if (this.worksTab === 'entries') return `参与 ${this.worksCount} 个词条`;
        if (this.worksTab === 'senses') return `补充 ${this.worksCount} 个义项`;
        return `留下 ${this.worksCount} 段录音`;
      }
      if (this.worksTab === 'entries') {
        return this.isSelf ? '还没有参与词条整理' : '还没有公开词条贡献';
      }
      if (this.worksTab === 'senses') {
        return this.isSelf ? '还没有提交义项' : '还没有公开义项';
      }
      return this.isSelf ? '还没有录音' : '还没有公开录音';
    },
    worksPanelCopy() {
      if (this.worksCount > 0) {
        return this.isSelf
          ? '完整记录在贡献履历中，可按录音、补证、修订和地区足迹查看。'
          : '这里只展示公开贡献数量；具体词条和录音可从听、查页面发现。';
      }
      if (this.worksTab === 'entries') {
        return this.isSelf
          ? '词条承载同一个词及其读音身份；不会写字也可以先录音。'
          : 'TA 还没有公开词条贡献。先去听乡音，或者稍后再来看看。';
      }
      if (this.worksTab === 'senses') {
        return this.isSelf
          ? '义项记录同一词条下相关的编号义、用法和例句。'
          : 'TA 还没有公开义项。先去听推荐，或者稍后再来看看。';
      }
      return this.isSelf
        ? '每段录音独立保存地区、大意和授权，并可关联多个词条。'
        : 'TA 还没有公开录音。先去听推荐，或者稍后再来看看。';
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
    goRecord,
    goMails,
    goHome,
    goContributionHistory,
    openMail() {
      if (!requireAuth('dm', { page: 'user_detail', userId: this.id })) return;
      goMailSend(this.id);
    },
    contributionCount(kind) {
      const contribution = this.userInfo.contribution || {};
      if (this.isSelf) {
        return contribution[`${kind}_total`] ?? contribution[kind] ?? 0;
      }
      return contribution[kind] ?? 0;
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
