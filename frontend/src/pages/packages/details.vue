<template>
  <PageShell title="写法详情">
    <template v-if="pkg">
      <SectionBlock>
        <view class="name">
          {{ pkg.text }}
        </view>
        <view class="definition">
          {{ packageTypeText }}
        </view>
      </SectionBlock>

      <SectionBlock
        title="关联义项"
        :empty="!pkg.flavors.length"
        empty-title="暂无关联义项"
      >
        <EntityCard
          v-for="flavor in pkg.flavors"
          :key="flavor.id"
          type="义项"
          :title="flavor.name"
          :description="flavor.definition || '暂无释义'"
          :meta="mandarinText(flavor)"
          :item="flavor"
          @open="toFlavor(flavor.id)"
        />
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import EntityCard from '@/components/EntityCard.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
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
  components: {
    EntityCard,
    PageShell,
    SectionBlock,
  },
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
  },
};
</script>

<style scoped>
.name {
  font-size: 48rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.definition {
  margin-top: 14rpx;
  color: #425148;
}
</style>
