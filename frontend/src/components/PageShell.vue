<template>
  <view class="page-shell">
    <view class="shell-topbar">
      <text
        v-if="showBack"
        class="shell-back"
        @tap="handleBack"
      >
        ‹
      </text>
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
  methods: {
    handleBack() {
      this.$emit('back');
      uni.navigateBack();
    },
  },
};
</script>

<style scoped>
.page-shell {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.shell-topbar {
  height: 96rpx;
  display: grid;
  grid-template-columns: 56rpx 1fr auto;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  background: #ffffff;
  border-bottom: 1px solid #e8ebe4;
  box-sizing: border-box;
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
  background: #1f5c43;
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
