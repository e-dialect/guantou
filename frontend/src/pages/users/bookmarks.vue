<template>
  <PageShell title="词条收藏">
    <BaseLoading
      v-if="loading"
      text="正在读取收藏…"
    />
    <EmptyState
      v-else-if="error"
      title="收藏暂时无法读取"
      :description="error"
      action-text="重试"
      @action="load"
    />
    <EmptyState
      v-else-if="!entries.length"
      title="还没有收藏词条"
      description="查词时收藏想继续听、继续考据的词条，会集中显示在这里。"
      action-text="去查词条"
      @action="goSearch"
    />
    <view
      v-else
      class="bookmark-list"
    >
      <view
        v-for="entry in entries"
        :key="entry.id"
        class="bookmark-card"
      >
        <view
          class="bookmark-card__copy"
          @tap="goEntryDetail(entry.id)"
        >
          <view class="bookmark-card__title">
            {{ entryTitle(entry) }}
          </view>
          <view class="bookmark-card__summary">
            {{ entry.summary || '大意待补充' }}
          </view>
          <view class="bookmark-card__meta">
            {{ dialectLabel(entry.usage_dialect) }} · {{ entry.recording_count }} 段录音
          </view>
        </view>
        <BaseButton
          size="small"
          variant="ghost"
          text="取消收藏"
          @click="remove(entry.id)"
        />
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import {
  dialectLabel,
  entryTitle,
  listEntryBookmarks,
  pageResults,
  unbookmarkEntry,
} from '@/services/entryRecording';
import { goEntryDetail, goSearch } from '@/services/navigation';

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, PageShell,
  },
  data() { return { entries: [], loading: true, error: '' }; },
  onLoad() { this.load(); },
  methods: {
    dialectLabel,
    entryTitle,
    goEntryDetail,
    goSearch,
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.entries = pageResults(await listEntryBookmarks({ page_size: 100 }));
      } catch (error) {
        this.error = error?.message || '请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
    async remove(id) {
      await unbookmarkEntry(id);
      this.entries = this.entries.filter((entry) => entry.id !== id);
    },
  },
};
</script>

<style scoped>
.bookmark-list { display: grid; gap: var(--space-3); }
.bookmark-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}
.bookmark-card__copy { min-width: 0; flex: 1; }
.bookmark-card__title { font-size: var(--font-size-lg); font-weight: 800; }
.bookmark-card__summary { margin-top: var(--space-1); line-height: 1.5; }
.bookmark-card__meta {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}
</style>
