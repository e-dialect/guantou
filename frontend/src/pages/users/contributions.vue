<template>
  <PageShell title="贡献履历">
    <view class="intro card">
      <view class="eyebrow">
        可追溯的参与记录
      </view>
      <view class="title">
        记录你留下了什么，不给人排权威高低
      </view>
      <view class="copy">
        录音、原始证据、整理修订和地区足迹分别呈现；数量只帮助你找回自己的贡献。
      </view>
    </view>

    <view
      v-if="loading"
      class="card muted"
    >
      正在整理你的贡献记录…
    </view>
    <EmptyState
      v-else-if="error"
      title="贡献履历加载失败"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <template v-else>
      <view class="metrics">
        <view
          v-for="item in metrics"
          :key="item.key"
          class="metric card"
        >
          <view class="metric-number">
            {{ item.value }}
          </view>
          <view class="metric-label">
            {{ item.label }}
          </view>
        </view>
      </view>

      <view class="card">
        <view class="eyebrow">
          地区足迹
        </view>
        <view
          v-if="!history.dialect_footprint?.length"
          class="muted"
        >
          还没有形成地区足迹。
        </view>
        <view
          v-for="item in history.dialect_footprint"
          :key="item.dialect.id"
          class="row"
        >
          <DialectLabel
            :dialect="item.dialect"
            mode="card"
          />
          <text class="row-value">
            {{ item.contribution_count }} 次参与
          </text>
        </view>
      </view>

      <view class="card">
        <view class="eyebrow">
          最近参与
        </view>
        <EmptyState
          v-if="!history.recent_activity?.length"
          title="还没有贡献记录"
          description="你可以先录下一段会说的乡音，写法和音标都可以以后补。"
          action-text="去录乡音"
          @action="goRecord"
        />
        <view
          v-for="event in history.recent_activity"
          :key="`${event.kind}-${event.target_id}-${event.created_at}`"
          class="activity"
        >
          <view>
            <view class="activity-kind">
              {{ kindLabel(event.kind) }}
            </view>
            <view class="activity-label">
              {{ event.label }}
            </view>
          </view>
          <view class="date">
            {{ dateLabel(event.created_at) }}
          </view>
        </view>
      </view>
    </template>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import DialectLabel from '@/components/DialectLabel.vue';
import EmptyState from '@/components/EmptyState.vue';
import { getMyContributionHistory } from '@/services/entryRecording';
import { goRecord } from '@/services/navigation';

export default {
  components: { PageShell, DialectLabel, EmptyState },
  data() { return { history: {}, loading: true, error: '' }; },
  computed: {
    metrics() {
      const summary = this.history.summary || {};
      return [
        { key: 'recordings', label: '录音', value: summary.recordings || 0 },
        { key: 'evidence', label: '补证', value: summary.evidence || 0 },
        { key: 'revisions', label: '修订', value: summary.revisions || 0 },
        { key: 'dialects', label: '地区足迹', value: summary.dialects || 0 },
      ];
    },
  },
  onLoad() { this.load(); },
  methods: {
    goRecord,
    kindLabel(kind) {
      return ({
        recording: '录音', evidence: '补证', revision: '修订', attestation: '地区确认',
      })[kind] || '贡献';
    },
    dateLabel(value) { return value ? String(value).slice(0, 10) : ''; },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.history = await getMyContributionHistory();
      } catch (error) {
        this.error = error?.message || '请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.card {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}
.eyebrow { color: var(--accent-color); font-size: var(--font-size-xs); font-weight: 700; }
.title { margin-top: var(--space-1); font-size: var(--font-size-xl); font-weight: 700; }
.copy, .muted { margin-top: var(--space-2); color: var(--text-secondary-color); line-height: 1.6; }
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.metric { margin-bottom: 0; text-align: center; }
.metric-number { font-size: var(--font-size-xxl); font-weight: 700; }
.metric-label,
.row-value,
.date { color: var(--text-secondary-color); font-size: var(--font-size-xs); }
.row,
.activity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}
.row:last-child, .activity:last-child { border-bottom: 0; }
.activity { align-items: flex-start; }
.activity-kind { color: var(--accent-color); font-size: var(--font-size-xs); }
.activity-label { margin-top: var(--space-1); overflow-wrap: anywhere; }
.date { flex: 0 0 auto; }
</style>
