<template>
  <view class="home-top-bar">
    <view class="home-top-bar__row">
      <!-- 左侧轻入口 -->
      <view class="home-top-bar__entries">
        <view
          class="home-top-bar__entry"
          role="button"
          aria-label="方言圈"
          @tap="toCircles"
        >
          <text class="home-top-bar__entry-glyph">
            ◎
          </text>
        </view>
        <view
          class="home-top-bar__entry"
          role="button"
          aria-label="发现"
          @tap="toDiscovery"
        >
          <text class="home-top-bar__entry-glyph">
            ✦
          </text>
        </view>
      </view>

      <!-- 中间内容 tab -->
      <view
        class="home-top-bar__tabs"
        role="tablist"
      >
        <view
          v-for="tab in HOME_FEED_TABS"
          :key="tab.key"
          class="home-top-bar__tab"
          :class="{ 'home-top-bar__tab--active': tab.key === activeTab }"
          role="tab"
          :aria-selected="tab.key === activeTab ? 'true' : 'false'"
          @tap="switchTab(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>

      <!-- 右侧搜索 -->
      <view
        class="home-top-bar__search home-search-entry"
        role="button"
        aria-label="搜索"
        @tap="toSearch"
      >
        <view
          class="home-top-bar__search-icon"
          aria-hidden="true"
        />
      </view>
    </view>

    <!-- 品牌小标（保留 h5-smoke 断言文案） -->
    <view class="home-top-bar__brand">
      {{ appName }} · 把乡音装进罐头
    </view>
  </view>
</template>

<script>
import { HOME_FEED_TABS } from '@/services/homeFeed';
import { APP_NAME } from '@/const/branding';
import { goCircleList, goDiscovery, goSearch } from '@/services/navigation';

export default {
  name: 'HomeTopBar',
  props: {
    activeTab: {
      type: String,
      default: 'recommended',
    },
  },
  emits: ['change'],
  data() {
    return {
      HOME_FEED_TABS,
      appName: APP_NAME,
    };
  },
  methods: {
    switchTab(key) {
      if (key !== this.activeTab) {
        this.$emit('change', key);
      }
    },
    toCircles() {
      goCircleList();
    },
    toDiscovery() {
      goDiscovery();
    },
    toSearch() {
      goSearch();
    },
  },
};
</script>

<style scoped>
.home-top-bar {
  padding: 12rpx 24rpx 0;
}

.home-top-bar__row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* ---------- 轻入口 ---------- */
.home-top-bar__entries {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.home-top-bar__entry {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.home-top-bar__entry:active {
  background: var(--immersive-surface-color);
}

.home-top-bar__entry-glyph {
  color: var(--on-immersive-muted-color);
  font-size: 30rpx;
  line-height: 1;
}

/* ---------- tab ---------- */
.home-top-bar__tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30rpx;
}

.home-top-bar__tab {
  position: relative;
  padding: 12rpx 4rpx;
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-base);
  font-weight: 500;
  letter-spacing: 2rpx;
  transition: color 0.25s ease;
}

.home-top-bar__tab--active {
  color: var(--on-immersive-color);
  font-size: var(--font-size-lg);
  font-weight: 900;
}

.home-top-bar__tab--active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 36rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--immersive-accent-color);
  box-shadow: 0 0 12rpx var(--immersive-glow-color);
}

/* ---------- 搜索 ---------- */
.home-top-bar__search {
  flex: 0 0 auto;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.home-top-bar__search:active {
  background: var(--immersive-surface-color);
}

/* 纯 CSS 放大镜 */
.home-top-bar__search-icon {
  position: relative;
  width: 34rpx;
  height: 34rpx;
}

.home-top-bar__search-icon::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 24rpx;
  height: 24rpx;
  border: 4rpx solid var(--on-immersive-color);
  border-radius: 50%;
  box-sizing: border-box;
}

.home-top-bar__search-icon::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 2rpx;
  width: 12rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--on-immersive-color);
  transform: rotate(45deg);
}

/* ---------- 品牌小标 ---------- */
.home-top-bar__brand {
  margin-top: 6rpx;
  text-align: center;
  color: var(--on-immersive-faint-color);
  font-size: 18rpx;
  letter-spacing: 6rpx;
}
</style>
