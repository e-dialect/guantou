<template>
  <view class="section">
    <view class="section-head">
      <text class="section-title">
        {{ title }}
      </text>
      <text class="section-count">
        {{ items.length }}
      </text>
    </view>
    <slot v-if="items.length" />
    <EmptyState
      v-else
      :title="emptyTitle"
      :description="emptyDescription"
    />
  </view>
</template>

<script>
import EmptyState from './EmptyState.vue';

export default {
  name: 'ResultSection',
  components: {
    EmptyState,
  },
  props: {
    title: {
      type: String,
      required: true,
    },
    items: {
      type: Array,
      default: () => [],
    },
    emptyTitle: {
      type: String,
      default: '暂无结果',
    },
    emptyDescription: {
      type: String,
      default: '',
    },
  },
};
</script>

<style scoped>
.section {
  margin-bottom: 28rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.section-title {
  color: #2f4638;
  font-weight: 700;
  font-size: 30rpx;
}

.section-count {
  color: #7a867d;
  font-size: 24rpx;
}
</style>
