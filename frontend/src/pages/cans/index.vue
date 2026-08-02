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
        罐头集盒
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
      <CanCard
        v-for="item in cans"
        :key="item.id"
        :can="item"
        @open="toDetail"
      />
      <EmptyState
        v-if="loadingStatus === 'noMore' && !cans.length"
        title="还没有罐头"
        description="先装一罐乡音，后面的人就能继续贴铭牌。"
        action-text="装一罐"
        @action="toCreate"
      />
      <uni-load-more :status="loadingStatus" />
    </scroll-view>
  </view>
</template>

<script>
import CanCard from '@/components/CanCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listCans } from '@/services/guantou';

export default {
  components: {
    CanCard,
    EmptyState,
  },
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

</style>
