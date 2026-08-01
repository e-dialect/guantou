<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        义项图鉴
      </text>
    </view>
    <view class="search-row">
      <input
        v-model="search"
        class="search"
        placeholder="搜索义项、释义、写法"
        @confirm="refresh"
      >
      <button
        class="small-button"
        @tap="refresh"
      >
        搜索
      </button>
    </view>
    <scroll-view
      scroll-y
      class="list"
    >
      <view
        v-for="item in flavors"
        :key="item.id"
        class="flavor-card"
        @tap="toDetail(item.id)"
      >
        <view class="name">
          {{ item.name }}
        </view>
        <view class="definition">
          {{ item.definition }}
        </view>
        <view class="meta">
          {{ item.variants.length }} 个变体 · {{ item.package_links.length }} 个写法
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { listFlavors } from '@/services/guantou';

export default {
  data() {
    return { search: '', flavors: [] };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    async refresh() {
      const res = await listFlavors({ search: this.search });
      this.flavors = res.results || res;
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/flavors/details?id=${id}` });
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

.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16rpx;
  padding: 24rpx 28rpx 0;
}

.search {
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
}

.small-button {
  background: #1f5c43;
  color: #fff;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.list {
  height: calc(100vh - 180rpx);
  padding: 24rpx 28rpx;
  box-sizing: border-box;
}

.flavor-card {
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
