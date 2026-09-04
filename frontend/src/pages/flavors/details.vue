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
        <view
          v-if="flavorIds.length > 1"
          class="aggregate-note"
        >
          此页合并了 {{ flavorIds.length }} 个同名义项；新增内容时需要选择具体义项。
        </view>
        <button
          class="primary-button"
          @tap="toCreateForFlavor"
        >
          用我的方言录一版
        </button>
        <button
          class="secondary-button"
          @tap="toCreatePronunciation"
        >
          添加词典读音
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
        :empty="!flavor.pronunciations.length"
        empty-title="暂无读音变体"
      >
        <view
          v-for="pronunciation in flavor.pronunciations"
          :key="pronunciation.id"
          class="variant"
        >
          <text>{{ dialectCardLabel(pronunciation.dialect) }}</text>
          <text>{{ pronunciationLabel(pronunciation) }}</text>
        </view>
      </SectionBlock>

      <SectionBlock title="相关罐头">
        <CanList
          :fetcher="fetchRelatedCans"
          :query="{}"
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
import { dialectCardLabel } from '@/utils/dialectTree';
import {
  goCanDetail,
  goCreateCan,
  goPackageDetail,
  goPronunciationCreate,
} from '@/services/navigation';

export function formatPronunciationLabel(pronunciation) {
  const base = pronunciation.base_romanization;
  const surface = pronunciation.surface_romanization;
  if (base && surface && base !== surface) {
    return `本调 ${base} → 变调 ${surface}`;
  }
  return surface || base || pronunciation.ipa || '未标音';
}

function uniqueIds(items) {
  return [...new Set((items || [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0))]
    .slice(0, 20);
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = String(item?.id ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sameFlavorIdentity(left, right) {
  return String(left?.name || '').trim() === String(right?.name || '').trim()
    && String(left?.definition || '').trim() === String(right?.definition || '').trim();
}

export default {
  components: {
    CanList,
    PageShell,
    SectionBlock,
  },
  data() {
    return { flavor: null, id: 0, ids: [] };
  },
  computed: {
    flavorIds() {
      if (this.flavor?.flavor_ids?.length) return uniqueIds(this.flavor.flavor_ids);
      return uniqueIds(this.ids.length ? this.ids : [this.id]);
    },
  },
  async onLoad(options) {
    this.id = options.id;
    this.ids = uniqueIds(String(options.ids || '').split(','));
    if (!this.ids.includes(Number(this.id))) this.ids.unshift(Number(this.id));
    await this.refresh();
  },
  async onShow() {
    if (this.id) await this.refresh();
  },
  methods: {
    dialectCardLabel,
    pronunciationLabel: formatPronunciationLabel,
    async refresh() {
      const primary = await getFlavor(this.id);
      const variantIds = uniqueIds(this.ids).filter((id) => id !== Number(primary.id));
      const variants = (await Promise.all(
        variantIds.map((id) => getFlavor(id).catch(() => null)),
      ))
        .filter((item) => sameFlavorIdentity(primary, item));
      this.flavor = this.mergeFlavors([primary, ...variants]);
    },
    mergeFlavors(items) {
      const validItems = (items || []).filter((item) => item?.id);
      return {
        ...(validItems[0] || {}),
        flavor_ids: uniqueIds(validItems.map((item) => item.id)),
        pronunciations: uniqueById(
          validItems.flatMap((item) => item.pronunciations || []),
        ),
        package_links: uniqueById(
          validItems.flatMap((item) => item.package_links || []),
        ),
      };
    },
    async fetchRelatedCans(params = {}) {
      const responses = await Promise.all(
        this.flavorIds.map((flavorId) => listCans({ ...params, flavor_id: flavorId })),
      );
      return {
        results: uniqueById(
          responses.flatMap((response) => response.results || response || []),
        ),
        next: null,
      };
    },
    flavorTargetLabel(id, index) {
      return `${this.flavor?.name || '义项'}（义项 #${id} · 第 ${index + 1} 个）`;
    },
    selectFlavorTarget(onSelected) {
      if (typeof onSelected !== 'function') return;
      const { flavorIds } = this;
      if (flavorIds.length <= 1) {
        if (flavorIds[0]) onSelected(flavorIds[0]);
        return;
      }
      if (typeof uni === 'undefined' || typeof uni.showActionSheet !== 'function') {
        if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
          uni.showToast({ title: '请选择具体义项后再操作', icon: 'none' });
        }
        return;
      }
      const pageSize = flavorIds.length > 6 ? 4 : 6;
      const showPage = (page) => {
        const pageCount = Math.ceil(flavorIds.length / pageSize);
        const start = page * pageSize;
        const pageIds = flavorIds.slice(start, start + pageSize);
        const hasPrevious = page > 0;
        const hasNext = page < pageCount - 1;
        const itemList = pageIds.map(
          (id, index) => this.flavorTargetLabel(id, start + index),
        );
        if (hasPrevious) itemList.unshift('上一页');
        if (hasNext) itemList.push('下一页');
        uni.showActionSheet({
          itemList,
          success: ({ tapIndex }) => {
            const index = Number(tapIndex);
            if (hasPrevious && index === 0) {
              showPage(page - 1);
              return;
            }
            if (hasNext && index === itemList.length - 1) {
              showPage(page + 1);
              return;
            }
            const selectedId = pageIds[index - (hasPrevious ? 1 : 0)];
            if (selectedId) onSelected(selectedId);
          },
          fail: () => {
            if (typeof uni.showToast === 'function') {
              uni.showToast({ title: '请选择具体义项后再操作', icon: 'none' });
            }
          },
        });
      };
      showPage(0);
    },
    resolveFlavorTarget(targetId, onSelected) {
      const normalizedId = Number(targetId);
      if (this.flavorIds.includes(normalizedId)) {
        onSelected(normalizedId);
        return;
      }
      this.selectFlavorTarget(onSelected);
    },
    toCan(id) {
      goCanDetail(id);
    },
    toPackage(id) {
      goPackageDetail(id);
    },
    toCreateForFlavor(targetId) {
      this.resolveFlavorTarget(targetId, (selectedId) => {
        if (!requireAuth('record_can', {
          page: 'flavor_detail',
          flavorId: selectedId,
          flavorName: this.flavor.name,
        })) return;
        goCreateCan({ flavor: selectedId, flavor_name: this.flavor.name });
      });
    },
    toCreatePronunciation(targetId) {
      this.resolveFlavorTarget(targetId, (selectedId) => {
        if (!requireAuth('pronunciation_create', {
          page: 'flavor_detail',
          flavorId: selectedId,
        })) return;
        goPronunciationCreate(selectedId);
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

.aggregate-note {
  margin-top: 14rpx;
  color: #66736b;
  font-size: 24rpx;
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

.secondary-button {
  margin-top: 14rpx;
  border: 1px solid #1f5c43;
  background: #ffffff;
  color: #1f5c43;
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
