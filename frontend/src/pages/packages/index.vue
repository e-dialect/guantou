<template>
  <PageShell
    title="写法图鉴"
    :scroll="true"
    @scrolltolower="loadMore"
  >
    <view class="filters">
      <view class="search-row">
        <input
          v-model="search"
          class="search-input"
          confirm-type="search"
          placeholder="搜索字、词或罗马字"
          @confirm="refresh"
        >
        <button
          class="small-button"
          @tap="refresh"
        >
          搜索
        </button>
      </view>
      <picker
        :range="packageTypeOptions"
        range-key="label"
        :value="packageTypeIndex"
        @change="onPackageTypeChange"
      >
        <view class="picker-field">
          类型 · {{ packageTypeOptions[packageTypeIndex].label }}
        </view>
      </picker>
    </view>

    <view
      v-if="initialLoading"
      class="skeleton-list"
    >
      <view
        v-for="index in 3"
        :key="index"
        class="skeleton-card"
      />
    </view>

    <view
      v-if="errorMessage"
      class="error-state"
    >
      <text>{{ errorMessage }}</text>
      <button @tap="refresh">
        重试
      </button>
    </view>

    <EntityCard
      v-for="item in packages"
      :key="item.id"
      type="写法"
      :title="item.text"
      :description="packageTypeLabel(item.package_type)"
      :meta="`${(item.flavors || []).length} 个关联义项`"
      :item="item"
      @open="toDetail(item.id)"
    />

    <EmptyState
      v-if="showEmpty"
      title="没有找到写法"
      description="换个关键词或类型看看，也可以回到义项图鉴继续浏览。"
      action-text="浏览全部"
      @action="resetFilters"
    />
    <uni-load-more
      v-if="packages.length"
      :status="loadingStatus"
    />
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import EntityCard from '@/components/EntityCard.vue';
import PageShell from '@/components/PageShell.vue';
import { listPackages } from '@/services/guantou';

export const PACKAGE_TYPES = [
  { value: '', label: '全部写法' },
  { value: 'orthodox', label: '正字' },
  { value: 'loan', label: '借字' },
  { value: 'popular', label: '俗写' },
  { value: 'phonetic', label: '拟音' },
  { value: 'romanization', label: '罗马字' },
  { value: 'uncertain', label: '不确定' },
];

export function packageListParams(search, packageType, page = 1) {
  const params = { page };
  const keyword = String(search || '').trim();
  if (keyword) params.search = keyword;
  if (packageType) params.package_type = packageType;
  return params;
}

export default {
  components: {
    EmptyState,
    EntityCard,
    PageShell,
  },
  data() {
    return {
      errorMessage: '',
      initialLoading: false,
      loadingStatus: 'more',
      packageType: '',
      packageTypeOptions: PACKAGE_TYPES,
      packages: [],
      page: 1,
      search: '',
    };
  },
  computed: {
    packageTypeIndex() {
      const index = this.packageTypeOptions.findIndex(
        (item) => item.value === this.packageType,
      );
      return index < 0 ? 0 : index;
    },
    showEmpty() {
      return !this.initialLoading && !this.errorMessage && !this.packages.length;
    },
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    packageTypeLabel(value) {
      return this.packageTypeOptions.find((item) => item.value === value)?.label || value;
    },
    async refresh() {
      this.page = 1;
      this.errorMessage = '';
      this.initialLoading = !this.packages.length;
      this.loadingStatus = 'loading';
      try {
        const response = await listPackages(
          packageListParams(this.search, this.packageType, this.page),
        );
        this.packages = response.results || response || [];
        this.loadingStatus = response.next ? 'more' : 'noMore';
      } catch (error) {
        this.errorMessage = '写法加载失败，请重试';
        this.loadingStatus = 'more';
      } finally {
        this.initialLoading = false;
      }
    },
    async loadMore() {
      if (this.loadingStatus !== 'more') return;
      const nextPage = this.page + 1;
      this.loadingStatus = 'loading';
      try {
        const response = await listPackages(
          packageListParams(this.search, this.packageType, nextPage),
        );
        this.page = nextPage;
        const knownIds = new Set(this.packages.map((item) => item.id));
        const additions = (response.results || response || []).filter(
          (item) => !knownIds.has(item.id),
        );
        this.packages = this.packages.concat(additions);
        this.loadingStatus = response.next ? 'more' : 'noMore';
      } catch (error) {
        this.errorMessage = '加载更多失败，请稍后重试';
        this.loadingStatus = 'more';
      }
    },
    onPackageTypeChange(event) {
      this.packageType = this.packageTypeOptions[Number(event.detail.value)]?.value || '';
      this.refresh();
    },
    resetFilters() {
      this.search = '';
      this.packageType = '';
      this.refresh();
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/packages/details?id=${id}` });
    },
  },
};
</script>

<style scoped>
.filters {
  margin-bottom: 24rpx;
}

.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16rpx;
}

.search-input,
.picker-field {
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  background: #ffffff;
}

.search-input {
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
}

.picker-field {
  margin-top: 16rpx;
  border-radius: 12rpx;
  padding: 18rpx 22rpx;
  color: #425148;
}

.small-button {
  margin: 0;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #ffffff;
  font-size: 26rpx;
}

.skeleton-card {
  height: 170rpx;
  margin-bottom: 18rpx;
  border-radius: 12rpx;
  background: #e9ede6;
}

.error-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f8ece8;
  color: #8b4438;
}

.error-state button {
  flex: 0 0 auto;
  margin: 0;
  color: #8b4438;
  font-size: 24rpx;
}
</style>
