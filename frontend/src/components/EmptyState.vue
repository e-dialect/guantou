<template>
  <view class="empty-state">
    <view class="empty-title">
      {{ title }}
    </view>
    <view
      v-if="description"
      class="empty-description"
    >
      {{ description }}
    </view>
    <button
      v-if="actionText"
      class="empty-action"
      @tap="$emit('action')"
    >
      {{ actionText }}
    </button>
  </view>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    actionText: {
      type: String,
      default: '',
    },
  },
  emits: ['action'],
};
</script>

<style scoped>
.empty-state {
  padding: 72rpx 24rpx;
  text-align: center;
  color: #7a867d;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #425148;
}

.empty-description {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.empty-action {
  margin-top: 24rpx;
  width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1f5c43;
  color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  padding: 0 28rpx;
}
</style>
