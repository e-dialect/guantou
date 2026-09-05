<template>
  <view
    class="immersive-shell home-page"
    :class="[`accent-${accent}`]"
    :style="outfitVars"
  >
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
      <!-- 已访问过的 tab 保持挂载（v-if 常驻），v-show 切换可见性：
           切回已加载的 tab 不重请求、不闪烁；首次进入仍走原加载流程 -->
      <HomeFeed
        v-if="listenAvailable && isTabAlive('today')"
        v-show="activeTab === 'today'"
        :key="`today-${feedRevision}`"
        class="home-page__feed"
        tab="today"
        :swipe-disabled="sheetActive"
        @share="prepareShare"
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('dialect')"
        v-show="activeTab === 'dialect'"
        :key="`dialect-${feedRevision}`"
        class="home-page__feed"
        tab="dialect"
        :swipe-disabled="sheetActive"
        @share="prepareShare"
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('following')"
        v-show="activeTab === 'following'"
        :key="`following-${feedRevision}`"
        class="home-page__feed"
        tab="following"
        :swipe-disabled="sheetActive"
        @share="prepareShare"
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('recommended')"
        v-show="activeTab === 'recommended'"
        :key="`recommended-${feedRevision}`"
        class="home-page__feed"
        tab="recommended"
        :swipe-disabled="sheetActive"
        @share="prepareShare"
      />
      <view
        v-if="!listenAvailable"
        class="home-page__unavailable"
      >
        听音功能正在维护，请稍后再来。查词条和个人资料仍可正常使用。
      </view>
    </view>

    <HomeTabBar active="listen" />

    <!-- 半屏评论区（见 #219）：全局浮层，包装 CommentThread，沉浸流内嵌深色主题 -->
    <CommentSheet @active-change="onSheetActiveChange" />
  </view>
</template>

<script>
import CommentSheet from '@/components/CommentSheet.vue';
import HomeFeed from '@/components/home/RecordingFeed.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import HomeTopBar from '@/components/home/HomeTopBar.vue';
import { isLoggedIn } from '@/services/authGuard';
import {
  closeCommentSheet,
  isCommentSheetActive,
} from '@/services/commentSheet';
import { resolveDefaultTab } from '@/services/homeFeed';
import {
  CAPABILITIES,
  ensureCapability,
  isCapabilityEnabled,
} from '@/services/capabilities';
import { ROUTES } from '@/services/navigation';
import { SHARE_TITLE } from '@/const/branding';
import { canSharePayload } from '@/utils/shareCan';
import { stopAudio } from '@/utils/audio';
import {
  getAccentPreference,
  paintNativeChrome,
  resolveTheme,
} from '@/services/theme';
import { hydrateOutfitStyle } from '@/services/themeCenter';
import { getAppliedOutfitVars } from '@/services/themeSchema';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

/* 常驻 feed 数量上限：只保留最近访问的 2 个 tab，超出者从头部卸载，
 * 回访时按首次进入的懒加载流程重建，限制内存与并发请求 */
const MAX_ALIVE_TABS = 2;

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
      /* 已挂载的 feed tab：访问过即常驻，切回不重建不重请求 */
      visitedTabs: [],
      userSelectedTab: false,
      pendingShareCan: null,
      feedRevision: 0,
      accent: getAccentPreference(),
      sheetActive: false,
      outfitVars: {},
      listenAvailable: isCapabilityEnabled(CAPABILITIES.LISTEN_FEED),
    };
  },
  created() {
    /* 默认 tab 直接标记已访问，保持首次加载行为不变 */
    this.ensureTabVisited(this.activeTab);
    /* 记录首次可见时的登录态指纹（非响应式），供 onShow 比对 */
    this.lastFeedFingerprint = this.feedFingerprint();
    this.listenAvailable = ensureCapability(CAPABILITIES.LISTEN_FEED, 'listen');
    if (this.listenAvailable) this.trackListenView(this.activeTab);
  },
  mounted() {
    uni.$on('theme-change', this.handleThemeChange);
    this.syncChrome();
  },
  beforeUnmount() {
    uni.$off('theme-change', this.handleThemeChange);
  },
  onShareAppMessage() {
    if (this.pendingShareCan) return canSharePayload(this.pendingShareCan);
    return {
      title: SHARE_TITLE,
      path: ROUTES.home,
    };
  },
  onShow() {
    this.syncChrome();
    /*
     * 刷新触发条件（且仅限以下两种，普通从详情页等浏览返回不重建
     * feed，保留滚动位置与已加载数据）：
     * 1. 登录态变化：登录成功 / 登出 / token 过期被清除；
     * 2. 主方言变化：onboarding 换主方言后返回。
     */
    if (!this.userSelectedTab) {
      this.activeTab = resolveDefaultTab();
      this.ensureTabVisited(this.activeTab);
    }
    if (this.feedFingerprint() !== this.lastFeedFingerprint) {
      this.lastFeedFingerprint = this.feedFingerprint();
      /* 指纹变化时把常驻集合收敛为仅当前激活 tab：
       * 避免全部常驻 feed 同时重建产生多路并发请求 */
      this.visitedTabs = [this.activeTab];
      this.feedRevision += 1;
    }
  },
  onHide() {
    stopAudio();
    // 半屏评论面板不随页面保留：离开首页即收起，避免从详情页/登录页返回时陈旧目标仍打开（#255）。
    closeCommentSheet();
  },
  onBackPress() {
    // 面板打开时返回键先关闭面板而非退出页面；关闭后再返回保持原有退出行为（#255）。
    if (isCommentSheetActive()) {
      closeCommentSheet();
      return true;
    }
    return false;
  },
  onUnload() {
    uni.$off('theme-change', this.handleThemeChange);
    stopAudio();
  },
  methods: {
    handleThemeChange(theme) {
      this.accent = theme?.accent || getAccentPreference();
      this.syncOutfitVars();
      this.paintImmersiveWindow();
    },
    syncChrome() {
      hydrateOutfitStyle();
      this.accent = getAccentPreference();
      this.syncOutfitVars();
      this.paintImmersiveWindow();
    },
    syncOutfitVars() {
      this.outfitVars = getAppliedOutfitVars();
    },
    paintImmersiveWindow() {
      paintNativeChrome({
        resolved: resolveTheme(),
        accent: this.accent,
        immersive: true,
      });
    },
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
    isTabAlive(tab) {
      return this.visitedTabs.includes(tab);
    },
    /* 访问过的 tab 移入队尾（最近访问），超出上限时从队头卸载最旧者 */
    ensureTabVisited(tab) {
      const index = this.visitedTabs.indexOf(tab);
      if (index >= 0) {
        this.visitedTabs.splice(index, 1);
      }
      this.visitedTabs.push(tab);
      if (this.visitedTabs.length > MAX_ALIVE_TABS) {
        this.visitedTabs.splice(0, this.visitedTabs.length - MAX_ALIVE_TABS);
      }
    },
    switchTab(tab) {
      if (tab === this.activeTab) return;
      stopAudio();
      this.userSelectedTab = true;
      this.ensureTabVisited(tab);
      this.activeTab = tab;
      this.trackListenView(tab);
    },
    onSheetActiveChange(active) {
      // 评论面板打开时锁定底层罐头流滑动，避免上下滑同时驱动 swiper 与评论列表
      this.sheetActive = active;
    },
    prepareShare(can) {
      this.pendingShareCan = can;
    },
    trackListenView(tab) {
      trackProductEvent(PRODUCT_EVENTS.LISTEN_FEED_VIEW, {
        surface: 'listen',
        result: 'view',
        metadata: { tab },
      });
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
  letter-spacing: var(--dress-letter-spacing, 0em);
  /* 深色渐变跟随当前配色色相，不随明暗主题翻转 */
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
  opacity: var(--dress-grain-opacity, 0.16);
  background-image: var(--dress-grain-image, var(--grain-dot));
  background-size: var(--dress-grain-size, 46rpx 46rpx);
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

.home-page__unavailable {
  margin: auto 40rpx;
  padding: 34rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  background: var(--immersive-surface-color);
  color: var(--on-immersive-color);
  line-height: 1.7;
}

/* feed 首次挂载淡入；已访问的 tab 经 v-show 切换不再重播，避免闪烁 */
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
