<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        写法详情
      </text>
    </view>
    <scroll-view
      v-if="pkg"
      scroll-y
      class="content"
    >
      <view class="section">
        <view class="name">
          {{ pkg.text }}
        </view>
        <view class="definition">
          {{ packageTypeText }}
        </view>
      </view>
      <view class="section">
        <view class="section-title">
          关联义项
        </view>
        <view
          v-for="flavor in pkg.flavors"
          :key="flavor.id"
          class="flavor-card"
          @tap="toFlavor(flavor.id)"
        >
          <view class="flavor-name">
            {{ flavor.name }}
          </view>
          <view class="flavor-definition">
            {{ flavor.definition || '暂无释义' }}
          </view>
          <view class="flavor-meta">
            {{ mandarinText(flavor) }}
          </view>
        </view>
        <view
          v-if="!pkg.flavors.length"
          class="empty"
        >
          暂无关联义项
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getPackage } from '@/services/guantou';

const packageTypeLabels = {
  orthodox: '正字',
  loan: '借字',
  popular: '俗写',
  phonetic: '拟音',
  romanization: '罗马字',
  uncertain: '不确定',
};

export default {
  data() {
    return { pkg: null };
  },
  computed: {
    packageTypeText() {
      return packageTypeLabels[this.pkg.package_type] || this.pkg.package_type;
    },
  },
  async onLoad(options) {
    this.pkg = await getPackage(options.id);
  },
  methods: {
    mandarinText(flavor) {
      return (flavor.mandarin || []).join(' / ') || '未填写普通话概念';
    },
    toFlavor(id) {
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
  font-size: 48rpx;
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

.flavor-card {
  padding: 18rpx 0;
  border-bottom: 1px solid #eef1eb;
}

.flavor-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f5c43;
}

.flavor-definition {
  margin-top: 8rpx;
  color: #425148;
}

.flavor-meta {
  margin-top: 8rpx;
  color: #7a867d;
  font-size: 24rpx;
}

.empty {
  color: #7a867d;
  padding: 18rpx 0;
}
</style>
