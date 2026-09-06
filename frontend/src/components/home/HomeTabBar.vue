<template>
  <view class="home-tab-bar">
    <view class="home-tab-bar__inner">
      <view
        v-for="item in items"
        :key="item.key"
        class="home-tab-bar__item"
        :class="{
          'home-tab-bar__item--active': active === item.key,
          'home-tab-bar__item--record': item.key === 'record',
        }"
        :data-nav-state="navState(item.key)"
        role="button"
        :aria-label="item.ariaLabel"
        :aria-current="active === item.key ? 'page' : undefined"
        @tap="open(item.key)"
      >
        <view
          class="home-tab-bar__glyph"
          aria-hidden="true"
        >
          {{ item.label }}
        </view>
        <text class="home-tab-bar__hint">
          {{ item.hint }}
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { requireAuth } from '@/services/authGuard';
import {
  goHome,
  goMine,
  goRecord,
  goSearch,
} from '@/services/navigation';

const ITEMS = Object.freeze([
  {
    key: 'listen', label: '听', hint: '乡音', ariaLabel: '听乡音',
  },
  {
    key: 'search', label: '查', hint: '词条', ariaLabel: '查找词条',
  },
  {
    key: 'record', label: '录', hint: '贡献', ariaLabel: '录制乡音',
  },
  {
    key: 'me', label: '我', hint: '账户', ariaLabel: '我的账户',
  },
]);

export default {
  name: 'HomeTabBar',
  props: {
    active: { type: String, default: 'listen' },
  },
  data() {
    return { items: ITEMS };
  },
  methods: {
    navState(key) {
      if (key === this.active) return 'selected';
      return key === 'record' ? 'action' : 'idle';
    },
    open(key) {
      if (key === this.active) return;
      if (key === 'listen') goHome(true);
      if (key === 'search') goSearch({ reset: true });
      if (key === 'record') {
        if (requireAuth('record_recording', { page: 'main_navigation' })) goRecord();
      }
      if (key === 'me') goMine(true);
    },
  },
};
</script>

<style scoped>
.home-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  background: linear-gradient(
    180deg,
    var(--immersive-bg-soft-color),
    var(--immersive-bg-color)
  );
  border-top: 1rpx solid var(--dress-tab-bar-border-color, var(--immersive-border-color));
  backdrop-filter: blur(18rpx);
  padding-bottom: env(safe-area-inset-bottom);
}

.home-tab-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--dress-tab-bar-background, transparent);
  pointer-events: none;
}

.home-tab-bar__inner {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: 112rpx;
}

.home-tab-bar__item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  color: var(--dress-tab-bar-color, var(--on-immersive-muted-color));
}

.home-tab-bar__glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  font-size: 29rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.home-tab-bar__hint {
  font-size: 18rpx;
  letter-spacing: 2rpx;
}

.home-tab-bar__item--active {
  color: var(--dress-tab-bar-accent, var(--immersive-accent-color));
}

.home-tab-bar__item--active .home-tab-bar__glyph,
.home-tab-bar__item--record.home-tab-bar__item--active .home-tab-bar__glyph {
  background: var(--dress-tab-bar-accent, var(--immersive-accent-color));
  color: var(--dress-tab-bar-on-accent, var(--immersive-bg-strong-color));
}

.home-tab-bar__item--record .home-tab-bar__glyph {
  width: 58rpx;
  height: 58rpx;
  border-radius: var(--radius-pill);
  transform: translateY(-3rpx);
}

.home-tab-bar__item--record:not(.home-tab-bar__item--active) .home-tab-bar__hint {
  color: var(--dress-tab-bar-emphasis, var(--on-immersive-color));
}

.home-tab-bar__item--record:not(.home-tab-bar__item--active) .home-tab-bar__glyph {
  border: 2rpx solid var(--dress-tab-bar-accent, var(--immersive-accent-color));
  background: var(--dress-tab-bar-background, var(--immersive-surface-color));
  color: var(--dress-tab-bar-accent, var(--immersive-accent-color));
}

/* #ifdef H5 */
@media screen and (min-width: 960px) {
  .home-tab-bar {
    left: 50%;
    right: auto;
    width: 960px;
    transform: translateX(-50%);
  }
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .home-tab-bar__inner {
    height: 64px;
  }

  .home-tab-bar__item {
    flex-direction: row;
    gap: 8px;
  }

  .home-tab-bar__glyph,
  .home-tab-bar__item--record .home-tab-bar__glyph {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: 20px;
    transform: none;
  }

  .home-tab-bar__hint {
    font-size: 12px;
    letter-spacing: 1px;
  }
}
/* #endif */
</style>
