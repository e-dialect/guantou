<template>
  <view class="section-block">
    <view
      v-if="title || actionText"
      class="section-head"
    >
      <text class="section-title">
        {{ title }}
      </text>
      <text
        v-if="actionText"
        class="section-action"
        @tap="$emit('action')"
      >
        {{ actionText }}
      </text>
    </view>
    <slot v-if="!empty" />
    <slot
      v-else
      name="empty"
    >
      <EmptyState
        :title="emptyTitle"
        :description="emptyDescription"
        :action-text="emptyActionText"
        @action="$emit('empty-action')"
      />
    </slot>
  </view>
</template>

<script>
import EmptyState from './EmptyState.vue';

export default {
  name: 'SectionBlock',
  components: {
    EmptyState,
  },
  props: {
    title: {
      type: String,
      default: '',
    },
    actionText: {
      type: String,
      default: '',
    },
    empty: {
      type: Boolean,
      default: false,
    },
    emptyTitle: {
      type: String,
      default: '暂无内容',
    },
    emptyDescription: {
      type: String,
      default: '',
    },
    emptyActionText: {
      type: String,
      default: '',
    },
  },
  emits: ['action', 'empty-action'],
};
</script>

<style scoped>
.section-block {
  background: #ffffff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
}

.section-action {
  flex: 0 0 auto;
  color: #1f5c43;
  font-size: 26rpx;
}
</style>
