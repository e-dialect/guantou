<template>
  <PageShell title="词条收藏">
    <view class="bookmark-intro">
      <view class="eyebrow">
        私人书签
      </view>
      <view class="intro-title">
        把想继续听、继续查的词条放在一起
      </view>
      <view class="intro-copy">
        收藏只帮助你稍后找回词条，不会影响公开排序，也不会给词条或贡献者加分。
      </view>
      <view
        v-if="!loading && !error"
        class="collection-summary"
      >
        {{ collectionSummary }}
      </view>
    </view>

    <BaseLoading
      v-if="loading"
      text="正在读取你的词条收藏…"
    />
    <EmptyState
      v-else-if="error"
      title="收藏暂时没有加载出来"
      :description="error"
      action-text="重新加载"
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
      class="bookmark-archive"
    >
      <view class="section-heading">
        <view>
          <view class="section-kicker">
            已收藏
          </view>
          <view class="section-title">
            按词条继续浏览
          </view>
        </view>
        <view class="section-count">
          {{ entries.length }} 个
        </view>
      </view>

      <view class="bookmark-list">
        <view
          v-for="entry in entries"
          :key="entry.id"
          class="bookmark-card"
        >
          <view class="bookmark-card__head">
            <view class="entry-kind">
              词条
            </view>
            <view :class="['status-badge', entry.status]">
              {{ statusLabel(entry.status) }}
            </view>
          </view>
          <view class="bookmark-card__title">
            {{ entryTitle(entry) }}
          </view>
          <view class="bookmark-card__summary">
            {{ entry.summary || '大意待补充' }}
          </view>
          <view class="bookmark-card__meta">
            <view class="meta-chip">
              {{ dialectLabel(entry.usage_dialect) || '地区待补' }}
            </view>
            <view class="meta-chip">
              {{ entry.recording_count || 0 }} 段录音
            </view>
            <view
              v-if="entry.evidence_count"
              class="meta-chip"
            >
              {{ entry.evidence_count }} 份依据
            </view>
          </view>
          <view class="bookmark-card__actions">
            <BaseButton
              size="small"
              :disabled="removingId !== null"
              :aria-label="`查看词条：${entryTitle(entry)}`"
              text="查看词条"
              @click="goEntryDetail(entry.id)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              :loading="removingId === entry.id"
              :disabled="removingId !== null"
              :aria-label="`移出收藏：${entryTitle(entry)}`"
              text="移出收藏"
              @click="remove(entry.id)"
            />
          </view>
        </view>
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
import { notify, notifySuccess } from '@/services/feedback';
import { goEntryDetail, goSearch } from '@/services/navigation';

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, PageShell,
  },
  data() {
    return {
      entries: [],
      loading: true,
      error: '',
      removingId: null,
    };
  },
  computed: {
    collectionSummary() {
      return this.entries.length
        ? `${this.entries.length} 个词条，等你回来继续看`
        : '从一次查词开始，留下第一枚书签';
    },
  },
  onLoad() { this.load(); },
  methods: {
    dialectLabel,
    entryTitle,
    goEntryDetail,
    goSearch,
    statusLabel(status) {
      return ({
        published: '已公开', disputed: '有争议', draft: '待整理', rejected: '已退回',
      })[status] || '整理中';
    },
    async load() {
      this.loading = true;
      this.error = '';
      this.entries = [];
      try {
        this.entries = pageResults(await listEntryBookmarks({ page_size: 100 }));
      } catch (error) {
        this.error = error?.message || '请检查网络或登录状态后重试';
      } finally {
        this.loading = false;
      }
    },
    async remove(id) {
      if (this.removingId !== null) return;
      this.removingId = id;
      try {
        await unbookmarkEntry(id);
        this.entries = this.entries.filter((entry) => entry.id !== id);
        notifySuccess('已移出收藏');
      } catch (error) {
        notify({ title: error?.message || '暂时无法移出收藏' });
      } finally {
        this.removingId = null;
      }
    },
  },
};
</script>

<style scoped>
.bookmark-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow,
.section-kicker,
.entry-kind {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.intro-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.intro-copy,
.bookmark-card__summary {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.intro-copy {
  margin-top: var(--space-1);
}

.collection-summary {
  display: inline-flex;
  margin-top: var(--space-3);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.bookmark-archive {
  margin-top: var(--space-4);
}

.section-heading,
.bookmark-card__head,
.bookmark-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.section-heading {
  margin-bottom: var(--space-2);
}

.section-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.section-count {
  flex: 0 0 auto;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.bookmark-list {
  display: grid;
  gap: var(--space-2);
}

.bookmark-card {
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.entry-kind {
  letter-spacing: 0;
}

.status-badge {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.status-badge.published {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.status-badge.rejected {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.bookmark-card__title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.bookmark-card__summary {
  margin-top: var(--space-1);
}

.bookmark-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.meta-chip {
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.bookmark-card__actions {
  justify-content: flex-end;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}
</style>
