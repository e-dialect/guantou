<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        货架详情
      </text>
    </view>
    <scroll-view
      v-if="shelf"
      scroll-y
      class="content"
    >
      <view class="section">
        <view class="name">
          {{ shelf.title }}
        </view>
        <view class="definition">
          {{ shelf.description || '暂无简介' }}
        </view>
      </view>
      <view class="section">
        <view class="section-title">
          风味
        </view>
        <view
          v-for="flavor in shelf.flavors"
          :key="flavor.id"
          class="item"
          @tap="toFlavor(flavor.id)"
        >
          {{ flavor.name }}
        </view>
      </view>
      <view class="section">
        <view class="section-title">
          罐头
        </view>
        <view
          v-for="can in shelf.cans"
          :key="can.id"
          class="item"
          @tap="toCan(can.id)"
        >
          {{ can.primary_nameplate ? can.primary_nameplate.text_content : can.concept_text }}
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getShelf } from '@/services/guantou';

export default {
  data() {
    return { shelf: null };
  },
  async onLoad(options) {
    this.shelf = await getShelf(options.id);
  },
  methods: {
    toFlavor(id) {
      uni.navigateTo({ url: `/pages/flavors/details?id=${id}` });
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
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

.item {
  padding: 18rpx 0;
  border-bottom: 1px solid #eef1eb;
  color: #1f5c43;
}
</style>
