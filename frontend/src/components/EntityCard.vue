<template>
  <view
    class="entity-card"
    @tap="$emit('open', item)"
  >
    <view
      v-if="type"
      class="entity-type"
    >
      {{ type }}
    </view>
    <view class="entity-title">
      {{ title }}
    </view>
    <view
      v-if="description"
      class="entity-description"
    >
      {{ description }}
    </view>
    <view
      v-if="meta"
      class="entity-meta"
    >
      {{ meta }}
    </view>
  </view>
</template>

<script>
export default {
  name: 'EntityCard',
  props: {
    item: {
      type: Object,
      default: () => ({}),
    },
    type: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    meta: {
      type: String,
      default: '',
    },
  },
  emits: ['open'],
};
</script>

<style scoped>
.entity-card {
  background: #ffffff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  box-sizing: border-box;
}

.entity-type {
  color: #1f5c43;
  font-size: 24rpx;
  margin-bottom: 8rpx;
}

.entity-title {
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.entity-description {
  margin-top: 10rpx;
  color: #425148;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.entity-meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}
</style>
