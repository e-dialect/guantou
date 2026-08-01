<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        义项详情
      </text>
    </view>
    <scroll-view
      v-if="flavor"
      scroll-y
      class="content"
    >
      <view class="section">
        <view class="name">
          {{ flavor.name }}
        </view>
        <view class="definition">
          {{ flavor.definition }}
        </view>
      </view>
      <view class="section">
        <view class="section-title">
          写法
        </view>
        <text
          v-for="link in flavor.package_links"
          :key="link.id"
          class="tag"
        >
          {{ link.package.text }}
        </text>
      </view>
      <view class="section">
        <view class="section-title">
          读音变体
        </view>
        <view
          v-for="variant in flavor.variants"
          :key="variant.id"
          class="variant"
        >
          <text>{{ variant.dialect_detail ? variant.dialect_detail.name : '未标方言点' }}</text>
          <text>{{ variant.romanization || variant.ipa || '未标音' }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getFlavor } from '@/services/guantou';

export default {
  data() {
    return { flavor: null };
  },
  async onLoad(options) {
    this.flavor = await getFlavor(options.id);
  },
  methods: {
    goBack() {
      uni.navigateBack();
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.topbar {
  height: 96rpx;
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  background: #fff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 54rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.content {
  height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.section {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.name {
  font-size: 42rpx;
  font-weight: 800;
}

.definition {
  margin-top: 14rpx;
  color: #425148;
}

.section-title {
  font-weight: 700;
  margin-bottom: 16rpx;
}

.tag {
  display: inline-block;
  margin: 0 12rpx 12rpx 0;
  background: #e8f1eb;
  color: #1f5c43;
  border-radius: 999rpx;
  padding: 8rpx 18rpx;
}

.variant {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1px solid #eef1eb;
}
</style>
