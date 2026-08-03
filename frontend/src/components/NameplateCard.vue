<template>
  <view :class="['plate', plate.is_primary ? 'primary-plate' : '']">
    <view class="plate-title">
      <text class="plate-text">
        {{ plate.text_content }}
      </text>
      <text
        v-if="plate.is_primary"
        class="primary"
      >
        主铭牌
      </text>
    </view>
    <view class="plate-def">
      {{ plate.definition || '暂无释义' }}
    </view>
    <view
      v-if="plate.source_citation"
      class="plate-source"
    >
      来源：{{ plate.source_citation }}
    </view>
    <button
      class="vote"
      :disabled="plate.supported_by_current_user"
      @tap.stop="$emit('support', plate.id)"
    >
      {{ plate.supported_by_current_user ? '已支持' : '支持这张铭牌' }} · {{ plate.weight || 0 }}
    </button>
  </view>
</template>

<script>
export default {
  name: 'NameplateCard',
  props: {
    plate: {
      type: Object,
      required: true,
    },
  },
  emits: ['support'],
};
</script>

<style scoped>
.plate {
  padding: 20rpx 0;
  border-bottom: 1px solid #eef1eb;
}

.primary-plate {
  background: #f7fbf5;
  border: 1px solid #d7e6d3;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}

.plate-title {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 32rpx;
  font-weight: 700;
}

.plate-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.primary {
  flex: 0 0 auto;
  color: #1f5c43;
  font-size: 24rpx;
  background: #e8f1eb;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}

.plate-def,
.plate-source {
  margin-top: 8rpx;
  color: #56645b;
  line-height: 1.5;
}

.plate-source {
  font-size: 24rpx;
  color: #7a867d;
}

.vote {
  margin: 14rpx 0 0;
  font-size: 24rpx;
  background: #fff;
  border: 1px solid #cbd5c5;
  color: #2f4638;
}

.vote[disabled] {
  color: #7a867d;
  background: #f3f5f1;
}
</style>
