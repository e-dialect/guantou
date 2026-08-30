<template>
  <PageShell
    :title="circle ? circle.name : '方言圈'"
    :scroll="false"
    content-class="circle-detail-content"
    :action-text="circle ? (circle.is_member ? '退出' : '加入') : ''"
    @action="toggleMembership"
  >
    <view
      v-if="circle"
      class="circle-header"
    >
      <view class="description">
        {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
      </view>
      <view class="meta">
        {{ circle.member_count }} 位成员 · {{ circle.can_count }} 个公开罐头
      </view>
      <button
        class="record-button"
        hover-class="record-button--pressed"
        @tap="recordHere"
      >
        录一罐 {{ circle.dialect.name }}
      </button>
    </view>
    <CanList
      v-if="circle"
      :fetcher="fetchCircleCans"
      empty-title="圈里还没有公开罐头"
      empty-description="录下第一段乡音，邀请同乡一起校验。"
      empty-action-text="录第一罐"
      social
      @open="toCan"
      @comment="toCan"
      @empty-action="recordHere"
    />
    <view
      v-else-if="error"
      class="state error"
      hover-class="state--pressed"
      @tap="loadCircle"
    >
      {{ error }}，点此重试
    </view>
    <view
      v-else
      class="state"
    >
      正在加载方言圈…
    </view>
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { goCanDetail, goCreateCan } from '@/services/navigation';
import {
  getCircle, joinCircle, leaveCircle, listCircleCans,
} from '@/services/guantou';

export default {
  components: { CanList, PageShell },
  data() {
    return { circle: null, circleId: null, error: '' };
  },
  onLoad(options) {
    this.circleId = Number(options.id);
    this.loadCircle();
  },
  methods: {
    async loadCircle() {
      this.error = '';
      try {
        this.circle = await getCircle(this.circleId);
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      }
    },
    fetchCircleCans(params) {
      return listCircleCans(this.circleId, params);
    },
    async toggleMembership() {
      if (!this.circle) return;
      if (!requireAuth('circle_join', { page: 'circle_detail', circleId: this.circle.id })) return;
      const result = this.circle.is_member
        ? await leaveCircle(this.circle.id)
        : await joinCircle(this.circle.id);
      this.circle = { ...this.circle, ...result };
    },
    recordHere() {
      if (!requireAuth('record_can', {
        page: 'circle_detail',
        circleId: this.circle.id,
        dialectId: this.circle.dialect.id,
      })) return;
      goCreateCan({ dialect: this.circle.dialect.id });
    },
    toCan(id) {
      goCanDetail(id);
    },
  },
};
</script>

<style scoped>
:deep(.circle-detail-content) {
  display: flex;
  height: calc(100vh - 96rpx);
  min-height: 0;
  flex-direction: column;
  padding: var(--space-3) 28rpx var(--space-5);
}

.circle-header {
  flex: 0 0 auto;
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.description {
  color: var(--text-secondary-color);
  line-height: 1.55;
}

.meta {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.record-button {
  margin: var(--space-3) 0 0;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
  font-size: var(--font-size-sm);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.record-button::after {
  border: 0;
}

.record-button--pressed {
  transform: scale(0.98);
  opacity: 0.9;
}

.state {
  padding: 80rpx var(--space-3);
  color: var(--muted-color);
  text-align: center;
  transition: opacity 0.15s ease;
}

.state.error {
  color: var(--danger-color);
}

.state--pressed {
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .record-button,
  .state {
    transition: none;
  }
}
</style>
