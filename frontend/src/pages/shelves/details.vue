<template>
  <PageShell title="集盒详情">
    <template v-if="shelf">
      <SectionBlock>
        <view class="name">
          {{ shelf.title }}
        </view>
        <view class="definition">
          {{ shelf.description || '暂无简介' }}
        </view>
      </SectionBlock>

      <SectionBlock
        title="义项"
        :empty="!shelf.flavors.length"
        empty-title="暂无义项"
      >
        <EntityCard
          v-for="flavor in shelf.flavors"
          :key="flavor.id"
          type="义项"
          :title="flavor.name"
          :description="flavor.definition || '暂无释义'"
          :item="flavor"
          @open="toFlavor(flavor.id)"
        />
      </SectionBlock>

      <SectionBlock
        title="罐头"
        :empty="!shelf.cans.length"
        empty-title="暂无罐头"
      >
        <CanCard
          v-for="can in shelf.cans"
          :key="can.id"
          :can="can"
          @open="toCan"
        />
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import CanCard from '@/components/CanCard.vue';
import EntityCard from '@/components/EntityCard.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { getShelf } from '@/services/guantou';

export default {
  components: {
    CanCard,
    EntityCard,
    PageShell,
    SectionBlock,
  },
  data() {
    return { shelf: null };
  },
  async onLoad(options) {
    this.shelf = await getShelf(options.id);
  },
  methods: {
    toFlavor(id) {
      uni.navigateTo({ url: `/pages/flavors/details?id=${id}` });
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
  },
};
</script>

<style scoped>
.name {
  font-size: 42rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.definition {
  margin-top: 14rpx;
  color: #425148;
  line-height: 1.5;
}
</style>
