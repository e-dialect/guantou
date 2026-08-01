<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        主题集盒
      </text>
    </view>
    <scroll-view
      scroll-y
      class="list"
    >
      <view
        v-for="item in shelves"
        :key="item.id"
        class="shelf-card"
        @tap="toDetail(item.id)"
      >
        <view class="name">
          {{ item.title }}
        </view>
        <view class="definition">
          {{ item.description || '暂无简介' }}
        </view>
        <view class="meta">
          {{ item.flavors.length }} 个义项 · {{ item.cans.length }} 个罐头
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { listShelves } from '@/services/guantou';

export default {
  data() {
    return { shelves: [] };
  },
  async onLoad() {
    const res = await listShelves();
    this.shelves = res.results || res;
  },
  methods: {
    toDetail(id) {
      uni.navigateTo({ url: `/pages/shelves/details?id=${id}` });
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

.list {
  height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.shelf-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.name {
  font-size: 34rpx;
  font-weight: 700;
}

.definition {
  margin-top: 10rpx;
  color: #425148;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}
</style>
