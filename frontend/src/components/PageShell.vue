<template>
  <view
    class="page-shell"
    :class="`theme-${resolvedTheme}`"
  >
    <view class="shell-topbar">
      <text
        v-if="showBack"
        class="shell-back"
        @tap="handleBack"
      >
        ‹
      </text>
      <view
        v-else
        class="shell-back-placeholder"
      />
      <text class="shell-title">
        {{ title }}
      </text>
      <button
        v-if="actionText"
        class="shell-action"
        @tap="$emit('action')"
      >
        {{ actionText }}
      </button>
      <view
        v-else
        class="shell-action-placeholder"
      />
    </view>
    <slot name="before" />
    <scroll-view
      v-if="scroll"
      scroll-y
      class="shell-content shell-scroll"
      :class="contentClass"
      @scrolltolower="$emit('scrolltolower')"
    >
      <slot />
    </scroll-view>
    <view
      v-else
      class="shell-content"
      :class="contentClass"
    >
      <slot />
    </view>
  </view>
</template>

<script>
import { applyTheme, getThemePreference } from '@/services/theme';

export default {
  name: 'PageShell',
  props: {
    title: {
      type: String,
      required: true,
    },
    showBack: {
      type: Boolean,
      default: true,
    },
    actionText: {
      type: String,
      default: '',
    },
    scroll: {
      type: Boolean,
      default: true,
    },
    contentClass: {
      type: [String, Array, Object],
      default: '',
    },
  },
  emits: ['action', 'back', 'scrolltolower'],
  data() {
    return {
      resolvedTheme: 'light',
    };
  },
  mounted() {
    this.handleThemeChange(applyTheme(getThemePreference()));
    uni.$on('theme-change', this.handleThemeChange);
  },
  beforeUnmount() {
    uni.$off('theme-change', this.handleThemeChange);
  },
  methods: {
    handleThemeChange(theme) {
      this.resolvedTheme = theme?.resolved || 'light';
    },
    handleBack() {
      this.$emit('back');
      uni.navigateBack();
    },
  },
};
</script>

<style scoped>
.page-shell {
  --page-color: #f6f7f3;
  --surface-color: #ffffff;
  --text-color: #1d2a24;
  --muted-color: #647068;
  --border-color: #e8ebe4;
  --accent-color: #1f5c43;
  min-height: 100vh;
  background: var(--page-color);
  color: var(--text-color);
}

.page-shell.theme-dark {
  --page-color: #121915;
  --surface-color: #1d2822;
  --text-color: #edf4ef;
  --muted-color: #a9b8ae;
  --border-color: #34443a;
  --accent-color: #69b58b;
}

.shell-topbar {
  height: 96rpx;
  display: grid;
  grid-template-columns: 56rpx 1fr auto;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.shell-back,
.shell-back-placeholder {
  width: 56rpx;
}

.shell-back {
  font-size: 56rpx;
  line-height: 1;
}

.shell-title {
  min-width: 0;
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.shell-action,
.shell-action-placeholder {
  min-width: 0;
}

.shell-action {
  margin: 0;
  height: 58rpx;
  line-height: 58rpx;
  padding: 0 24rpx;
  background: var(--accent-color);
  color: #ffffff;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.shell-content {
  min-height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.shell-scroll {
  height: calc(100vh - 96rpx);
}
</style>
