<template>
  <view class="immersive-shell home-page">
    <!-- 氛围光与肌理（沉浸壳自绘背景） -->
    <view
      class="home-page__glow home-page__glow--top"
      aria-hidden="true"
    />
    <view
      class="home-page__glow home-page__glow--bottom"
      aria-hidden="true"
    />
    <view
      class="home-page__grain"
      aria-hidden="true"
    />

    <HomeTopBar
      class="home-page__top"
      :active-tab="activeTab"
      @change="switchTab"
    />

    <view class="home-page__body">
      <HomeFeed
        v-if="activeTab === 'today'"
        :key="`today-${feedRevision}`"
        class="home-page__feed"
        tab="today"
        @share="prepareShare"
      />
      <HomeFeed
        v-else-if="activeTab === 'dialect'"
        :key="`dialect-${feedRevision}`"
        class="home-page__feed"
        tab="dialect"
        @share="prepareShare"
      />
      <HomeFeed
        v-else-if="activeTab === 'following'"
        :key="`following-${feedRevision}`"
        class="home-page__feed"
        tab="following"
        @share="prepareShare"
      />
      <HomeFeed
        v-else
        :key="`recommended-${feedRevision}`"
        class="home-page__feed"
        tab="recommended"
        @share="prepareShare"
      />
    </view>

    <HomeTabBar active="home" />

    <!-- 半屏评论区（见 #219）：全局浮层，包装 CommentThread，沉浸流内嵌深色主题 -->
    <CommentSheet />
  </view>
</template>

<script>
import CommentSheet from '@/components/CommentSheet.vue';
import HomeFeed from '@/components/home/HomeFeed.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import HomeTopBar from '@/components/home/HomeTopBar.vue';
import { isLoggedIn } from '@/services/authGuard';
import { resolveDefaultTab } from '@/services/homeFeed';
import { ROUTES } from '@/services/navigation';
import { SHARE_TITLE } from '@/const/branding';
import { canSharePayload } from '@/utils/shareCan';
import { stopAudio } from '@/utils/audio';

export default {
  components: {
    CommentSheet,
    HomeFeed,
    HomeTabBar,
    HomeTopBar,
  },
  data() {
    return {
      activeTab: resolveDefaultTab(),
      userSelectedTab: false,
      pendingShareCan: null,
      feedRevision: 0,
    };
  },
  created() {
    /* 记录首次可见时的登录态指纹（非响应式），供 onShow 比对 */
    this.lastFeedFingerprint = this.feedFingerprint();
  },
  onShareAppMessage() {
    if (this.pendingShareCan) return canSharePayload(this.pendingShareCan);
    return {
      title: SHARE_TITLE,
      path: ROUTES.home,
    };
  },
  onShow() {
    /*
     * 刷新触发条件（且仅限以下两种，普通从详情页等浏览返回不重建
     * feed，保留滚动位置与已加载数据）：
     * 1. 登录态变化：登录成功 / 登出 / token 过期被清除；
     * 2. 主方言变化：onboarding 换主方言后返回。
     */
    if (!this.userSelectedTab) {
      this.activeTab = resolveDefaultTab();
    }
    if (this.feedFingerprint() !== this.lastFeedFingerprint) {
      this.lastFeedFingerprint = this.feedFingerprint();
      this.feedRevision += 1;
    }
  },
  onHide() {
    stopAudio();
  },
  onUnload() {
    stopAudio();
  },
  methods: {
    /*
     * feed 重建指纹：登录态（token 有无）+ 主方言。
     * 依赖的 storage / globalData 均非响应式，故用方法而非 computed，
     * 每次调用实时取值；feed 数据中的 liked_by_me /
     * recorder_followed_by_me / supported_by_current_user 等字段
     * 依赖登录态，主方言决定默认 tab 与同方言流内容。
     */
    feedFingerprint() {
      const app = typeof getApp === 'function' ? getApp() : null;
      const info = app && app.globalData ? app.globalData.userInfo : null;
      const dialect = info ? info.primary_dialect : null;
      return `${isLoggedIn() ? 'auth' : 'guest'}:${dialect ? JSON.stringify(dialect) : ''}`;
    },
    switchTab(tab) {
      if (tab === this.activeTab) return;
      stopAudio();
      this.userSelectedTab = true;
      this.activeTab = tab;
    },
    prepareShare(can) {
      this.pendingShareCan = can;
    },
  },
};
</script>

<style scoped>
.home-page {
  position: relative;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 固定深色渐变，不随明暗主题翻转 */
  background: linear-gradient(
    165deg,
    var(--immersive-bg-strong-color) 0%,
    var(--immersive-bg-soft-color) 38%,
    var(--immersive-bg-color) 100%
  );
  color: var(--on-immersive-color);
  padding-top: env(safe-area-inset-top);
}

/* 氛围光斑 */
.home-page__glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.home-page__glow--top {
  top: -220rpx;
  right: -180rpx;
  width: 640rpx;
  height: 640rpx;
  background: radial-gradient(circle, var(--immersive-glow-color) 0%, transparent 70%);
}

.home-page__glow--bottom {
  bottom: -260rpx;
  left: -200rpx;
  width: 720rpx;
  height: 720rpx;
  background: radial-gradient(circle, var(--immersive-glow-color) 0%, transparent 72%);
  opacity: 0.7;
}

/* 细颗粒肌理 */
.home-page__grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image: radial-gradient(var(--immersive-border-color) 1rpx, transparent 1rpx);
  background-size: 46rpx 46rpx;
}

.home-page__top {
  position: relative;
  z-index: 10;
}

.home-page__body {
  position: relative;
  z-index: 5;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(118rpx + env(safe-area-inset-bottom));
}

/* tab 切换时 feed 进入侧淡入（v-if 卸载侧不做退场，避免引入 <transition>） */
.home-page__feed {
  animation: home-feed-enter 0.2s ease-out;
}

@keyframes home-feed-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-page__feed {
    animation: none;
  }
}
</style>
