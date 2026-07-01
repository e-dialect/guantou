<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text>
      <text class="title">
        罐头货架
      </text>
      <button
        class="small-button"
        @tap="toCreate"
      >
        装罐
      </button>
    </view>
    <view class="filters">
      <input
        v-model="query.search"
        class="search"
        placeholder="搜索概念、铭牌、释义"
        @confirm="refresh"
      >
      <picker
        :range="statusOptions"
        range-key="label"
        @change="onStatusChange"
      >
        <view class="chip">
          {{ statusLabel }}
        </view>
      </picker>
    </view>
    <scroll-view
      scroll-y
      class="list"
      @scrolltolower="loadMore"
    >
      <view
        v-for="item in cans"
        :key="item.id"
        class="can-card"
        @tap="toDetail(item.id)"
      >
        <view class="card-head">
          <text class="label">
            {{ primaryText(item) }}
          </text>
          <text class="status">
            {{ statusText(item.status) }}
          </text>
        </view>
        <view class="concept">
          {{ item.concept_text || '未填写普通话概念' }}
        </view>
        <view class="meta">
          {{ locationText(item) }} · {{ item.nameplates.length }} 张铭牌 · {{ item.views }} 次查看
        </view>
      </view>
      <uni-load-more :status="loadingStatus" />
    </scroll-view>
  </view>
</template>

<script>
import { listCans } from '@/services/guantou';

const statusLabels = {
  unlabeled: '无标',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '争议',
  rejected: '已驳回',
};

export default {
  data() {
    return {
      page: 1,
      loadingStatus: 'more',
      cans: [],
      query: { search: '', status: '' },
      statusOptions: [
        { label: '全部状态', value: '' },
        { label: '无标', value: 'unlabeled' },
        { label: '待校验', value: 'pending' },
        { label: '社区暂定', value: 'tentative' },
        { label: '正品认证', value: 'verified' },
        { label: '争议', value: 'disputed' },
      ],
    };
  },
  computed: {
    statusLabel() {
      const item = this.statusOptions.find((option) => option.value === this.query.status);
      return item ? item.label : '全部状态';
    },
  },
  onLoad(options = {}) {
    if (options.mine) this.query.mine = options.mine;
    this.refresh();
  },
  methods: {
    statusText(status) {
      return statusLabels[status] || status;
    },
    primaryText(item) {
      return item.primary_nameplate ? item.primary_nameplate.text_content : '无标罐头';
    },
    locationText(item) {
      if (item.dialect_detail) return item.dialect_detail.name;
      return [item.county, item.town].filter(Boolean).join('-') || '未标产地';
    },
    async refresh() {
      this.page = 1;
      this.loadingStatus = 'loading';
      const res = await listCans({ ...this.query, page: this.page });
      this.cans = res.results || res;
      this.loadingStatus = res.next ? 'more' : 'noMore';
    },
    async loadMore() {
      if (this.loadingStatus !== 'more') return;
      this.page += 1;
      this.loadingStatus = 'loading';
      const res = await listCans({ ...this.query, page: this.page });
      this.cans = this.cans.concat(res.results || res);
      this.loadingStatus = res.next ? 'more' : 'noMore';
    },
    onStatusChange(e) {
      this.query.status = this.statusOptions[e.detail.value].value;
      this.refresh();
    },
    toCreate() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    toDetail(id) {
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
  gap: 20rpx;
  padding: 0 28rpx;
  background: #fff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 44rpx;
}

.title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 700;
}

.small-button {
  font-size: 26rpx;
  background: #1f5c43;
  color: #fff;
  border-radius: 999rpx;
  padding: 0 24rpx;
  height: 58rpx;
  line-height: 58rpx;
}

.filters {
  padding: 24rpx 28rpx 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16rpx;
}

.search,
.chip {
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
  font-size: 28rpx;
}

.list {
  height: calc(100vh - 180rpx);
  padding: 20rpx 28rpx 60rpx;
  box-sizing: border-box;
}

.can-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.label {
  font-size: 34rpx;
  font-weight: 700;
}

.status {
  font-size: 24rpx;
  color: #1f5c43;
  background: #e8f1eb;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.concept {
  margin-top: 14rpx;
  color: #33463b;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}
</style>
