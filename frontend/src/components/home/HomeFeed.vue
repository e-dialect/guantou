<template>
  <view class="home-feed">
    <!-- 引导态：游客关注流 / 未设主方言的同方言 -->
    <view
      v-if="guidance"
      class="home-feed__guidance"
    >
      <view class="home-feed__guidance-icon">
        {{ guidance.icon }}
      </view>
      <view class="home-feed__guidance-title">
        {{ guidance.title }}
      </view>
      <view class="home-feed__guidance-copy">
        {{ guidance.copy }}
      </view>
      <view
        class="home-feed__guidance-action"
        role="button"
        @tap="guidance.action"
      >
        {{ guidance.actionText }}
      </view>
    </view>

    <!-- 首屏骨架 -->
    <view
      v-else-if="loadingInitial && !items.length"
      class="home-feed__skeleton"
      aria-hidden="true"
    >
      <view class="home-feed__skeleton-avatar" />
      <view class="home-feed__skeleton-circle" />
      <view class="home-feed__skeleton-wave">
        <view
          v-for="index in 12"
          :key="index"
          class="home-feed__skeleton-bar"
        />
      </view>
      <view class="home-feed__skeleton-line home-feed__skeleton-line--lg" />
      <view class="home-feed__skeleton-line" />
      <view class="home-feed__skeleton-line" />
    </view>

    <!-- 失败兜底 -->
    <view
      v-else-if="errorMessage && !items.length"
      class="home-feed__error"
    >
      <view class="home-feed__error-text">
        {{ errorMessage }}
      </view>
      <view
        class="home-feed__error-retry"
        role="button"
        @tap="loadFirst"
      >
        点我重试
      </view>
    </view>

    <!-- 空态引导 -->
    <view
      v-else-if="!items.length"
      class="home-feed__empty"
    >
      <view class="home-feed__empty-title">
        {{ emptyText.title }}
      </view>
      <view class="home-feed__empty-copy">
        {{ emptyText.copy }}
      </view>
      <view
        class="home-feed__empty-action"
        role="button"
        @tap="emptyText.action"
      >
        {{ emptyText.actionText }}
      </view>
    </view>

    <!-- 评论面板打开时锁定罐头流：不渲染 swiper，改为静态当前页，杜绝共享滑动 -->
    <view
      v-else-if="swipeDisabled"
      class="home-feed__slide"
    >
      <CanStageCard
        v-if="currentCan"
        class="home-feed__card"
        :can="currentCan"
        :active="true"
      />
      <HomeActionRail
        v-if="currentCan"
        class="home-feed__rail"
        :can="currentCan"
        @share="$emit('share', $event)"
      />
    </view>

    <!-- 沉浸流主体 -->
    <swiper
      v-else
      class="home-feed__swiper"
      vertical
      :current="relativeCurrent"
      :duration="280"
      @change="onSwiperChange"
    >
      <swiper-item
        v-for="(can, offset) in visibleItems"
        :key="can.id"
      >
        <view class="home-feed__slide">
          <CanStageCard
            class="home-feed__card"
            :can="can"
            :active="windowStart + offset === currentIndex"
          />
          <HomeActionRail
            v-if="windowStart + offset === currentIndex"
            class="home-feed__rail"
            :can="can"
            @share="$emit('share', $event)"
          />
        </view>
      </swiper-item>
    </swiper>

    <!-- 加载更多指示：加载中显示，完成/无更多/失败时隐藏 -->
    <view
      v-if="loadingMore"
      class="home-feed__load-more"
      aria-hidden="true"
    >
      <view class="home-feed__spinner" />
    </view>

    <!-- 加载更多失败条 -->
    <view
      v-if="errorMessage && items.length"
      class="home-feed__error-bar"
      role="button"
      @tap="loadMore"
    >
      {{ errorMessage }} · 点我重试
    </view>
  </view>
</template>

<script>
import CanStageCard from '@/components/home/CanStageCard.vue';
import HomeActionRail from '@/components/home/HomeActionRail.vue';
import { isLoggedIn, requireAuth } from '@/services/authGuard';
import { getTodayCan, listHomeFeed } from '@/services/homeFeed';
import { toLoginPage } from '@/routers/login';
import { preload, stopAudio } from '@/utils/audio';
import { goCreateCan, goDiscovery, goOnboarding } from '@/services/navigation';

const WINDOW_RADIUS = 2;
const WINDOW_SIZE = WINDOW_RADIUS * 2 + 1;
const PREFETCH_THRESHOLD = 3;

export default {
  name: 'HomeFeed',
  components: {
    CanStageCard,
    HomeActionRail,
  },
  props: {
    tab: {
      type: String,
      required: true,
    },
    /* 评论面板打开时锁定罐头流滑动，避免上下滑同时驱动 swiper 与评论列表 */
    swipeDisabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['share'],
  data() {
    return {
      items: [],
      page: 1,
      hasMore: false,
      loadingInitial: false,
      loadingMore: false,
      errorMessage: '',
      currentIndex: 0,
    };
  },
  computed: {
    isGuest() {
      return !isLoggedIn();
    },
    primaryDialect() {
      const app = typeof getApp === 'function' ? getApp() : null;
      return (app && app.globalData && app.globalData.userInfo
        && app.globalData.userInfo.primary_dialect) || null;
    },
    guidance() {
      if (this.tab === 'following' && this.isGuest) {
        return {
          icon: '♡',
          title: '登录后看关注流',
          copy: '关注同乡与校验伙伴，他们的每一罐新乡音都会出现在这里。',
          actionText: '去登录',
          action: toLoginPage,
        };
      }
      if (this.tab === 'dialect' && !this.primaryDialect) {
        return {
          icon: '◎',
          title: '先选一个主方言',
          copy: '设置主方言后，这里会聚合同方言点的乡音与校验。',
          actionText: '去选主方言',
          action: this.toOnboarding,
        };
      }
      return null;
    },
    emptyText() {
      if (this.tab === 'today') {
        return {
          title: '今日罐还在路上',
          copy: '稍后再来看看，或者先逛逛推荐流。',
          actionText: '装一罐',
          action: this.toCreate,
        };
      }
      if (this.tab === 'following') {
        return {
          title: '关注流还是空的',
          copy: '去发现页关注几位同乡，他们的乡音会出现在这里。',
          actionText: '去发现看看',
          action: this.toDiscovery,
        };
      }
      return {
        title: '这里还没有罐头',
        copy: '录下第一段乡音，让后来的人有铭牌可贴。',
        actionText: '装一罐',
        action: this.toCreate,
      };
    },
    windowStart() {
      const maxStart = Math.max(0, this.items.length - WINDOW_SIZE);
      return Math.min(Math.max(this.currentIndex - WINDOW_RADIUS, 0), maxStart);
    },
    visibleItems() {
      return this.items.slice(this.windowStart, this.windowStart + WINDOW_SIZE);
    },
    relativeCurrent() {
      return this.currentIndex - this.windowStart;
    },
    currentCan() {
      return this.items[this.currentIndex] || null;
    },
  },
  mounted() {
    this.loadFirst();
  },
  beforeUnmount() {
    stopAudio();
  },
  methods: {
    uniqueItems(items) {
      const seen = new Set();
      return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    },
    async loadFirst() {
      this.loadingInitial = true;
      this.errorMessage = '';
      try {
        if (this.tab === 'today') {
          this.items = [await getTodayCan()];
          this.hasMore = false;
        } else {
          const response = await listHomeFeed(this.tab, 1);
          this.items = this.uniqueItems(response.results || []);
          this.page = 1;
          this.hasMore = Boolean(response.next);
        }
        this.currentIndex = 0;
        this.prepareAround(0);
      } catch (error) {
        this.errorMessage = '内容加载失败';
      } finally {
        this.loadingInitial = false;
      }
    },
    async loadMore() {
      if (this.loadingMore || !this.hasMore || this.tab === 'today') return;
      this.loadingMore = true;
      this.errorMessage = '';
      try {
        const nextPage = this.page + 1;
        const response = await listHomeFeed(this.tab, nextPage);
        this.page = nextPage;
        this.items = this.uniqueItems(this.items.concat(response.results || []));
        this.hasMore = Boolean(response.next);
      } catch (error) {
        this.errorMessage = '加载更多失败';
      } finally {
        this.loadingMore = false;
      }
    },
    onSwiperChange(event) {
      const next = this.windowStart + event.detail.current;
      if (next === this.currentIndex || !this.items[next]) return;
      stopAudio();
      this.currentIndex = next;
      this.prepareAround(next);
    },
    prepareAround(index) {
      const nextCan = this.items[index + 1];
      if (nextCan && nextCan.audio_url) {
        preload(nextCan.audio_url);
      }
      if (this.hasMore && index >= this.items.length - PREFETCH_THRESHOLD) {
        this.loadMore();
      }
    },
    toOnboarding() {
      goOnboarding();
    },
    toDiscovery() {
      goDiscovery();
    },
    toCreate() {
      if (!requireAuth('record_can', { page: 'home_feed' })) return;
      goCreateCan();
    },
  },
};
</script>

<style scoped>
.home-feed {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.home-feed__swiper {
  height: 100%;
  width: 100%;
}

.home-feed__slide {
  position: relative;
  height: 100%;
  box-sizing: border-box;
}

.home-feed__card {
  height: 100%;
  /* 右侧为互动栏预留：rail 实占（头像 88rpx + 边框）约 94rpx + right 24rpx + 呼吸间隙 */
  padding-right: 140rpx;
}

/* 互动栏在整屏 slide 内竖直居中；slide 底边已由 .home-page__body 的
 * padding-bottom 避开 TabBar，故无需额外下探补偿 */
.home-feed__rail {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
}

/* ---------- 引导 / 空态 / 失败 ---------- */
.home-feed__guidance,
.home-feed__empty,
.home-feed__error {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 0 64rpx;
  text-align: center;
  box-sizing: border-box;
}

.home-feed__guidance-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 2rpx solid var(--immersive-border-color);
  background: var(--immersive-surface-color);
  color: var(--immersive-accent-color);
  font-size: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.home-feed__guidance-title,
.home-feed__empty-title {
  color: var(--on-immersive-color);
  font-size: var(--font-size-xl);
  font-weight: 900;
  letter-spacing: 2rpx;
}

.home-feed__guidance-copy,
.home-feed__empty-copy {
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  max-width: 480rpx;
}

.home-feed__guidance-action,
.home-feed__empty-action,
.home-feed__error-retry {
  margin-top: 14rpx;
  padding: 18rpx 56rpx;
  border-radius: var(--radius-pill);
  background: var(--immersive-accent-color);
  color: var(--immersive-bg-color);
  font-size: var(--font-size-base);
  font-weight: 800;
  letter-spacing: 2rpx;
  box-shadow: 0 12rpx 32rpx var(--immersive-glow-color);
}

.home-feed__error-text {
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-sm);
}

.home-feed__error-bar {
  position: absolute;
  left: 50%;
  bottom: 24rpx;
  transform: translateX(-50%);
  z-index: 5;
  padding: 10rpx 28rpx;
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-strong-color);
  border: 1rpx solid var(--immersive-border-color);
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
}

/* ---------- 加载更多指示 ---------- */
.home-feed__load-more {
  position: absolute;
  left: 50%;
  bottom: 24rpx;
  transform: translateX(-50%);
  z-index: 4;
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-color);
  border: 1rpx solid var(--immersive-border-color);
  display: flex;
  align-items: center;
}

.home-feed__spinner {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 3rpx solid var(--immersive-border-color);
  border-top-color: var(--immersive-accent-color);
  animation: home-feed-spin 0.8s linear infinite;
}

@keyframes home-feed-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 退化为静态圆环，不旋转 */
  .home-feed__spinner {
    animation: none;
  }
}

/* ---------- 骨架屏 ---------- */
.home-feed__skeleton {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 24rpx;
  padding: 48rpx 48rpx 160rpx;
  box-sizing: border-box;
}

.home-feed__skeleton-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--immersive-skeleton-color);
}

.home-feed__skeleton-circle {
  align-self: center;
  width: 156rpx;
  height: 156rpx;
  border-radius: 50%;
  background: var(--immersive-skeleton-color);
}

.home-feed__skeleton-wave {
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 80rpx;
}

.home-feed__skeleton-bar {
  flex: 1;
  height: 60%;
  border-radius: 999rpx;
  background: linear-gradient(
    100deg,
    var(--immersive-skeleton-color) 30%,
    var(--immersive-skeleton-highlight-color) 50%,
    var(--immersive-skeleton-color) 70%
  );
  background-size: 200% 100%;
  animation: immersive-shimmer 1.4s linear infinite;
}

.home-feed__skeleton-bar:nth-child(odd) {
  height: 90%;
}

.home-feed__skeleton-line {
  height: 30rpx;
  border-radius: 999rpx;
  background: linear-gradient(
    100deg,
    var(--immersive-skeleton-color) 30%,
    var(--immersive-skeleton-highlight-color) 50%,
    var(--immersive-skeleton-color) 70%
  );
  background-size: 200% 100%;
  animation: immersive-shimmer 1.4s linear infinite;
}

.home-feed__skeleton-line--lg {
  height: 56rpx;
}

@keyframes immersive-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-feed__skeleton-bar,
  .home-feed__skeleton-line {
    animation: none;
  }
}
</style>
