<template>
  <view class="page">
    <view class="header">
      <view>
        <view class="brand">
          方言罐头
        </view>
        <view class="subtitle">
          把每一段乡音装进可校验的资料库
        </view>
      </view>
      <button
        class="primary-mini"
        @tap="toCreate"
      >
        装罐
      </button>
    </view>

    <view
      class="search-box"
      @tap="toCans"
    >
      <text class="search-icon">
        ⌕
      </text>
      <text class="search-placeholder">
        搜索方言、正字、拼音、普通话概念
      </text>
    </view>

    <view class="quick-grid">
      <view
        class="quick-card shelf"
        @tap="toShelves"
      >
        <view class="quick-title">
          货架
        </view>
        <view class="quick-copy">
          按主题浏览罐头
        </view>
      </view>
      <view
        class="quick-card can"
        @tap="toCreate"
      >
        <view class="quick-title">
          装罐
        </view>
        <view class="quick-copy">
          录下新的乡音
        </view>
      </view>
      <view
        class="quick-card atlas"
        @tap="toFlavors"
      >
        <view class="quick-title">
          图鉴
        </view>
        <view class="quick-copy">
          看同一概念的不同写法
        </view>
      </view>
      <view
        class="quick-card mine"
        @tap="toMine"
      >
        <view class="quick-title">
          我的
        </view>
        <view class="quick-copy">
          贡献、积分和消息
        </view>
      </view>
    </view>

    <view class="section-head">
      <text>待贴铭牌</text>
      <text
        class="link"
        @tap="toCans"
      >
        全部
      </text>
    </view>
    <view
      v-for="item in cans"
      :key="item.id"
      class="can-card"
      @tap="toCan(item.id)"
    >
      <view class="card-title">
        {{ item.concept_text || '无标罐头' }}
      </view>
      <view class="card-meta">
        {{ locationText(item) }} · {{ item.status }}
      </view>
    </view>
  </view>
</template>

<script>
import { listCans } from '@/services/guantou';

export default {
  data() {
    return {
      cans: [],
    };
  },
  async onLoad() {
    const res = await listCans({ needs_label: 'true' });
    this.cans = (res.results || res).slice(0, 5);
  },
  onShareAppMessage() {
    return {
      title: '方言罐头：把乡音装进罐头',
      path: '/pages/index',
    };
  },
  methods: {
    locationText(item) {
      if (item.dialect_detail) return item.dialect_detail.name;
      return [item.county, item.town].filter(Boolean).join('-') || '未标产地';
    },
    toCreate() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    toCans() {
      uni.navigateTo({ url: '/pages/cans/index' });
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toFlavors() {
      uni.navigateTo({ url: '/pages/flavors/index' });
    },
    toShelves() {
      uni.navigateTo({ url: '/pages/shelves/index' });
    },
    toMine() {
      uni.navigateTo({ url: '/pages/users/me' });
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
  padding: 42rpx 28rpx 80rpx;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.brand {
  font-size: 54rpx;
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: 0;
}

.subtitle {
  margin-top: 12rpx;
  color: #5d6b61;
  font-size: 27rpx;
}

.primary-mini {
  margin: 0;
  background: #1f5c43;
  color: #fff;
  border-radius: 999rpx;
  font-size: 26rpx;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 26rpx;
}

.search-box {
  margin-top: 34rpx;
  height: 82rpx;
  border-radius: 16rpx;
  background: #fff;
  border: 1px solid #dfe5da;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  gap: 14rpx;
}

.search-icon {
  font-size: 34rpx;
  color: #1f5c43;
}

.search-placeholder {
  color: #7a867d;
  font-size: 28rpx;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 28rpx;
}

.quick-card {
  min-height: 168rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.shelf {
  background: #264d59;
}

.can {
  background: #1f5c43;
}

.atlas {
  background: #7b4f2f;
}

.mine {
  background: #555d49;
}

.quick-title {
  font-size: 34rpx;
  font-weight: 800;
}

.quick-copy {
  font-size: 25rpx;
  opacity: 0.9;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 36rpx 0 18rpx;
  font-weight: 800;
  font-size: 32rpx;
}

.link {
  color: #1f5c43;
  font-size: 26rpx;
}

.can-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: 700;
}

.card-meta {
  margin-top: 10rpx;
  color: #7a867d;
  font-size: 24rpx;
}
</style>
