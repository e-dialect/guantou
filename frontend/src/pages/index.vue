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
        tab="today"
        @share="prepareShare"
      />
      <HomeFeed
        v-else-if="activeTab === 'dialect'"
        :key="`dialect-${feedRevision}`"
        tab="dialect"
        @share="prepareShare"
      />
      <HomeFeed
        v-else-if="activeTab === 'following'"
        :key="`following-${feedRevision}`"
        tab="following"
        @share="prepareShare"
      />
      <HomeFeed
        v-else
        :key="`recommended-${feedRevision}`"
        tab="recommended"
        @share="prepareShare"
      />
    </view>

    <HomeTabBar active="home" />
  </view>
</template>

<script>
import HomeFeed from '@/components/home/HomeFeed.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import HomeTopBar from '@/components/home/HomeTopBar.vue';
import { resolveDefaultTab } from '@/services/homeFeed';
import { ROUTES } from '@/services/navigation';
import { SHARE_TITLE } from '@/const/branding';
import { canSharePayload } from '@/utils/shareCan';
import { stopAudio } from '@/utils/audio';

export default {
  components: {
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
  onShareAppMessage() {
    if (this.pendingShareCan) return canSharePayload(this.pendingShareCan);
    return {
      title: SHARE_TITLE,
      path: ROUTES.home,
    };
  },
  onShow() {
    /* 刷新登录态与主方言：用户未手动选过 tab 时重算默认 tab，并重建当前流 */
    if (!this.userSelectedTab) {
      this.activeTab = resolveDefaultTab();
    }
    this.feedRevision += 1;
  },
  onHide() {
    stopAudio();
  },
  onUnload() {
    stopAudio();
  },
  methods: {
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
</style>
