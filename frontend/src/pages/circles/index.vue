<template>
  <PageShell title="方言圈广场">
    <view class="search-row">
      <BaseField
        v-model="search"
        name="circle-search"
        label="方言圈"
        placeholder="搜索方言圈"
        @confirm="refresh"
      />
      <BaseButton
        text="搜索"
        @click="refresh"
      />
    </view>
    <view
      v-if="loading"
      class="state"
    >
      正在加载方言圈…
    </view>
    <view
      v-else-if="error"
      class="state error"
      hover-class="state--pressed"
      @tap="refresh"
    >
      {{ error }}，点此重试
    </view>
    <template v-else>
      <view
        v-for="circle in circles"
        :key="circle.id"
        class="circle-card"
        hover-class="card--pressed"
        @tap="toDetail(circle.id)"
      >
        <view class="circle-copy">
          <view class="circle-title">
            {{ circle.name }}
          </view>
          <view class="circle-description">
            {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
          </view>
          <view class="circle-meta">
            {{ circle.member_count }} 位成员 · {{ circle.recording_count }} 段公开录音
          </view>
        </view>
        <BaseButton
          size="small"
          :variant="circle.is_member ? 'ghost' : 'primary'"
          :text="circle.is_member ? '已加入' : '加入'"
          @click.stop="toggleMembership(circle)"
        />
      </view>
      <EmptyState
        v-if="!circles.length"
        title="还没有匹配的方言圈"
        description="可以换个关键词，或先去听公开乡音。"
        action-text="去听乡音"
        @action="toListen"
      />
    </template>
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { goCircleDetail, goHome } from '@/services/navigation';
import {
  joinCircle, leaveCircle, listCircles,
} from '@/services/guantou';

export default {
  components: {
    BaseButton, BaseField, EmptyState, PageShell,
  },
  data() {
    return {
      circles: [], error: '', loading: false, search: '',
    };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      this.error = '';
      try {
        const response = await listCircles({ search: this.search.trim() });
        this.circles = response.results || response || [];
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      } finally {
        this.loading = false;
      }
    },
    async toggleMembership(circle) {
      if (!requireAuth('circle_join', { page: 'circle_index', circleId: circle.id })) return;
      const result = circle.is_member
        ? await leaveCircle(circle.id)
        : await joinCircle(circle.id);
      this.circles = this.circles.map((item) => (item.id === circle.id
        ? { ...item, ...result }
        : item));
    },
    toDetail(id) {
      goCircleDetail(id);
    },
    toListen() {
      goHome(true);
    },
  },
};
</script>

<style scoped>
.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.circle-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.circle-copy {
  min-width: 0;
  flex: 1;
}

.circle-title {
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.circle-description {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  line-height: 1.5;
}

.circle-meta {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.state {
  padding: 70rpx var(--space-3);
  color: var(--muted-color);
  text-align: center;
  transition: opacity 0.15s ease;
}

.state.error {
  color: var(--danger-color);
}

.state--pressed,
.card--pressed {
  opacity: 0.7;
}

.card--pressed {
  transform: scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .circle-card,
  .state {
    transition: none;
  }
}
</style>
