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
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('dialect')"
        v-show="activeTab === 'dialect'"
        :key="`dialect-${feedRevision}`"
        class="home-page__feed"
        tab="dialect"
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('phrase')"
        v-show="activeTab === 'phrase'"
        :key="`phrase-${feedRevision}`"
        class="home-page__feed"
        tab="phrase"
      />
      <HomeFeed
        v-if="listenAvailable && isTabAlive('recommended')"
        v-show="activeTab === 'recommended'"
        :key="`recommended-${feedRevision}`"
        class="home-page__feed"
        tab="recommended"
      />
      <view
        v-if="!listenAvailable"
        class="home-page__unavailable"
        data-feed-state="maintenance"
      >
        <text class="home-page__unavailable-kicker">
          听音暂歇
        </text>
        <text class="home-page__unavailable-title">
          录音流正在维护
        </text>
        <text class="home-page__unavailable-copy">
          查词条和个人资料仍可正常使用，已保存的内容也不会受影响。
        </text>
        <BaseButton
          variant="light"
          text="先去查词条"
          @click="goSearch"
        />
      </view>
    </view>

    <HomeTabBar active="listen" />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import HomeFeed from '@/components/home/RecordingFeed.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import HomeTopBar from '@/components/home/HomeTopBar.vue';
import { isLoggedIn } from '@/services/authGuard';
import { resolveDefaultListenTab } from '@/services/listenFeed';
import {
  CAPABILITIES,
  ensureCapability,
  isCapabilityEnabled,
} from '@/services/capabilities';
import { stopAudio } from '@/utils/audio';
import {
  getAccentPreference,
  paintNativeChrome,
  resolveTheme,
} from '@/services/theme';
import { hydrateOutfitStyle } from '@/services/themeCenter';
import { getAppliedOutfitVars } from '@/services/themeSchema';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';
import { goSearch } from '@/services/navigation';

/* 常驻 feed 数量上限：只保留最近访问的 2 个 tab，超出者从头部卸载，
 * 回访时按首次进入的懒加载流程重建，限制内存与并发请求 */
const MAX_ALIVE_TABS = 2;

export default {
  components: {
    BaseButton,
    HomeFeed,
    HomeTabBar,
    HomeTopBar,
  },
  data() {
    return {
      activeTab: resolveDefaultListenTab(),
      /* 已挂载的 feed tab：访问过即常驻，切回不重建不重请求 */
      visitedTabs: [],
      userSelectedTab: false,
      feedRevision: 0,
      accent: getAccentPreference(),
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
  onShow() {
    this.syncChrome();
    /*
     * 刷新触发条件（且仅限以下两种，普通从详情页等浏览返回不重建
     * feed，保留滚动位置与已加载数据）：
     * 1. 登录态变化：登录成功 / 登出 / token 过期被清除；
     * 2. 主方言变化：onboarding 换主方言后返回。
     */
    if (!this.userSelectedTab) {
      this.activeTab = resolveDefaultListenTab();
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
  },
  onUnload() {
    uni.$off('theme-change', this.handleThemeChange);
    stopAudio();
  },
  methods: {
    goSearch,
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
     * 每次调用实时取值；feed 数据中的私有状态依赖登录态，
     * 主方言决定默认 tab 与同方言流内容。
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
  width: 100%;
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
  width: calc(100% - 80rpx);
  margin: auto 40rpx;
  padding: 48rpx 40rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18rpx;
  background: var(--immersive-surface-color);
  color: var(--on-immersive-color);
}

.home-page__unavailable-kicker {
  color: var(--immersive-accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.home-page__unavailable-title {
  font-family: STSong, SimSun, serif;
  font-size: 36rpx;
  font-weight: 900;
}

.home-page__unavailable-copy {
  margin-bottom: 6rpx;
  color: var(--on-immersive-muted-color);
  font-size: 25rpx;
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

/* #ifdef H5 */
.home-page {
  height: 100dvh;
}

@media screen and (min-width: 960px) {
  .home-page {
    max-width: 960px;
    margin: 0 auto;
    border-inline: 1rpx solid var(--immersive-border-color);
  }

  .home-page__body {
    width: 100%;
    max-width: 920px;
    margin-inline: auto;
  }
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .home-page__body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }

  .home-page__unavailable {
    width: calc(100% - 48px);
    margin: auto 24px;
    padding: 20px 28px;
    gap: 8px;
  }

  .home-page__unavailable-kicker {
    font-size: 12px;
    letter-spacing: 2px;
  }

  .home-page__unavailable-title {
    font-size: 22px;
  }

  .home-page__unavailable-copy {
    margin-bottom: 0;
    font-size: 14px;
    line-height: 1.4;
  }
}
/* #endif */
</style>
