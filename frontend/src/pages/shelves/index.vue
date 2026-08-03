<template>
  <PageShell title="主题集盒">
    <EntityCard
      v-for="item in shelves"
      :key="item.id"
      type="集盒"
      :title="item.title"
      :description="item.description || '暂无简介'"
      :meta="shelfMeta(item)"
      :item="item"
      @open="toDetail(item.id)"
    />
    <EmptyState
      v-if="!shelves.length"
      title="还没有集盒"
      description="后续可以用集盒收纳主题义项和精选罐头。"
    />
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import EntityCard from '@/components/EntityCard.vue';
import PageShell from '@/components/PageShell.vue';
import { listShelves } from '@/services/guantou';

export default {
  components: {
    EmptyState,
    EntityCard,
    PageShell,
  },
  data() {
    return { shelves: [] };
  },
  async onLoad() {
    const res = await listShelves();
    this.shelves = res.results || res;
  },
  methods: {
    shelfMeta(item) {
      return `${(item.flavors || []).length} 个义项 · ${(item.cans || []).length} 个罐头`;
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/shelves/details?id=${id}` });
    },
  },
};
</script>
