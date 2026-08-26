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
      <BaseButton
        v-if="actionText"
        class="shell-action"
        size="small"
        :text="actionText"
        @click="$emit('action')"
      />
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
    <FeedbackHost />
  </view>
</template>

<script>
import { applyTheme, getThemePreference } from '@/services/theme';
import { goBack, ROUTES } from '@/services/navigation';
import BaseButton from '@/components/BaseButton.vue';
import FeedbackHost from '@/components/FeedbackHost.vue';

export default {
  name: 'PageShell',
  components: { BaseButton, FeedbackHost },
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
    backFallback: {
      type: String,
      default: ROUTES.home,
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
      goBack(this.backFallback);
    },
  },
};
</script>

<style scoped>
/* 颜色 Token 来自全局 styles/tokens.scss；暗色由 .theme-dark 全局规则覆盖子树 */
.page-shell {
  min-height: 100vh;
  background: var(--page-color);
  color: var(--text-color);
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
