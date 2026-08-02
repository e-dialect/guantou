<template>
  <PageShell title="义项详情">
    <template v-if="flavor">
      <SectionBlock>
        <view class="name">
          {{ flavor.name }}
        </view>
        <view class="definition">
          {{ flavor.definition }}
        </view>
        <button
          class="primary-button"
          @tap="toCreateForFlavor"
        >
          用我的方言录一版
        </button>
      </SectionBlock>

      <SectionBlock
        title="写法"
        :empty="!flavor.package_links.length"
        empty-title="暂无关联写法"
      >
        <text
          v-for="link in flavor.package_links"
          :key="link.id"
          class="tag"
          @tap="toPackage(link.package.id)"
        >
          {{ link.package.text }}
        </text>
      </SectionBlock>

      <SectionBlock
        title="读音变体"
        :empty="!flavor.variants.length"
        empty-title="暂无读音变体"
      >
        <view
          v-for="variant in flavor.variants"
          :key="variant.id"
          class="variant"
        >
          <text>{{ variant.dialect_detail ? variant.dialect_detail.name : '未标方言点' }}</text>
          <text>{{ variant.romanization || variant.ipa || '未标音' }}</text>
        </view>
      </SectionBlock>

      <SectionBlock title="相关罐头">
        <CanList
          :fetcher="listCans"
          :query="{ flavor: id }"
          :scroll="false"
          empty-title="还没有相关罐头"
          empty-description="可以用自己的方言为这个义项补录一版。"
          empty-action-text="补录乡音"
          @open="toCan"
          @empty-action="toCreateForFlavor"
        />
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { requireAuth } from '@/services/authGuard';
import { getFlavor, listCans } from '@/services/guantou';

export default {
  components: {
    CanList,
    PageShell,
    SectionBlock,
  },
  data() {
    return { flavor: null, id: 0 };
  },
  async onLoad(options) {
    this.id = options.id;
    await this.refresh();
  },
  methods: {
    listCans,
    async refresh() {
      this.flavor = await getFlavor(this.id);
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toPackage(id) {
      uni.navigateTo({ url: `/pages/packages/details?id=${id}` });
    },
    toCreateForFlavor() {
      if (!requireAuth('record_can', { page: 'flavor_detail', flavorId: this.id })) return;
      uni.navigateTo({
        url: `/pages/cans/create?flavor=${this.id}&flavor_name=${encodeURIComponent(this.flavor.name)}`,
      });
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

.tag {
  display: inline-block;
  margin: 0 12rpx 12rpx 0;
  background: #e8f1eb;
  color: #1f5c43;
  border-radius: 999rpx;
  padding: 8rpx 18rpx;
}

.primary-button {
  margin-top: 24rpx;
  background: #1f5c43;
  color: #ffffff;
  border-radius: 12rpx;
}

.variant {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1px solid #eef1eb;
}
</style>
