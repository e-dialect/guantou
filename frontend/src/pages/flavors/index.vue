<template>
  <PageShell
    title="义项图鉴"
    :scroll="true"
  >
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
    <EntityCard
      v-for="item in flavors"
      :key="item.id"
      type="义项"
      :title="item.name"
      :description="item.definition"
      :meta="flavorMeta(item)"
      :item="item"
      @open="toDetail(item.id)"
    />
    <EmptyState
      v-if="!flavors.length"
      title="还没有义项"
      description="可以先从搜索或装罐流程里沉淀第一批义项。"
    />
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import EntityCard from '@/components/EntityCard.vue';
import PageShell from '@/components/PageShell.vue';
import { listFlavors } from '@/services/guantou';

export default {
  components: {
    EmptyState,
    EntityCard,
    PageShell,
  },
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
    flavorMeta(item) {
      return `${(item.variants || []).length} 个变体 · ${(item.package_links || []).length} 个写法`;
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/flavors/details?id=${id}` });
    },
  },
};
</script>

<style scoped>
.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.search {
  background: #ffffff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
}

.small-button {
  margin: 0;
  background: #1f5c43;
  color: #ffffff;
  border-radius: 999rpx;
  font-size: 26rpx;
}
</style>
