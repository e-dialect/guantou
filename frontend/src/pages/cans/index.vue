<template>
  <PageShell
    title="罐头集盒"
    action-text="装罐"
    :scroll="false"
    content-class="list-content"
    @action="toCreate"
  >
    <template #before>
      <view class="filters">
        <input
          v-model="query.search"
          class="search"
          placeholder="搜索概念、铭牌、释义"
          @confirm="refresh"
        >
        <picker
          v-if="isStaff"
          :range="statusOptions"
          range-key="label"
          @change="onStatusChange"
        >
          <view class="chip">
            {{ statusLabel }}
          </view>
        </picker>
      </view>
    </template>

    <CanList
      ref="canList"
      :fetcher="listCans"
      :query="query"
      empty-title="还没有罐头"
      empty-description="先装一罐乡音，后面的人就能继续贴铭牌。"
      empty-action-text="装一罐"
      @open="toDetail"
      @empty-action="toCreate"
    />
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import { listCans } from '@/services/guantou';

function currentUserIsStaff() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return Boolean(app?.globalData?.userInfo?.is_staff);
}

export default {
  components: {
    CanList,
    PageShell,
  },
  data() {
    return {
      isStaff: currentUserIsStaff(),
      query: { search: '', status: '' },
      statusOptions: [
        { label: '全部状态', value: '' },
        { label: '待校验', value: 'pending' },
        { label: '社区暂定', value: 'tentative' },
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
  },
  onShow() {
    this.isStaff = currentUserIsStaff();
    if (!this.isStaff && this.query.status) {
      this.query = { ...this.query, status: '' };
    }
  },
  methods: {
    listCans,
    refresh() {
      this.$refs.canList.refresh();
    },
    onStatusChange(e) {
      if (!this.isStaff) return;
      this.query = {
        ...this.query,
        status: this.statusOptions[e.detail.value].value,
      };
    },
    toCreate() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
  },
};
</script>

<style scoped>
.filters {
  padding: 24rpx 28rpx 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16rpx;
  background: #f6f7f3;
}

.search,
.chip {
  background: #ffffff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

:deep(.list-content) {
  height: calc(100vh - 180rpx);
  min-height: 0;
  padding: 20rpx 28rpx 60rpx;
}
</style>
