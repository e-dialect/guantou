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
        {{ circle.member_count }} 位成员 · {{ circle.recording_count }} 段公开录音
      </view>
      <BaseButton
        class="record-button"
        block
        :text="`录一段${circle.dialect.name}乡音`"
        @click="recordHere"
      />
    </view>
    <BaseLoading
      v-if="circle && loadingRecordings"
      text="正在寻找圈内乡音…"
    />
    <EmptyState
      v-else-if="circle && !recordings.length"
      title="圈里还没有公开录音"
      description="录下第一段乡音，邀请同乡一起补充词条和地区差异。"
      action-text="录第一段"
      @action="recordHere"
    />
    <scroll-view
      v-else-if="circle"
      scroll-y
      class="recording-list"
    >
      <EntryRecordingCard
        v-for="recording in recordings"
        :key="recording.id"
        :recording="recording"
        @open-entry="goEntryDetail"
        @continue="continueChain"
      />
    </scroll-view>
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
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { goEntryDetail, goRecord } from '@/services/navigation';
import {
  getCircle, joinCircle, leaveCircle, listCircleRecordings,
} from '@/services/guantou';
import { pageResults } from '@/services/entryRecording';

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, EntryRecordingCard, PageShell,
  },
  data() {
    return {
      circle: null, circleId: null, error: '', recordings: [], loadingRecordings: false,
    };
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
        await this.loadRecordings();
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      }
    },
    async loadRecordings() {
      this.loadingRecordings = true;
      try {
        this.recordings = pageResults(await listCircleRecordings(this.circleId, {
          page_size: 50,
        }));
      } finally {
        this.loadingRecordings = false;
      }
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
      if (!requireAuth('record_recording', {
        page: 'circle_detail',
        circleId: this.circle.id,
        dialectId: this.circle.dialect.id,
      })) return;
      goRecord({ dialect_id: this.circle.dialect.id });
    },
    goEntryDetail,
    continueChain(entryId) {
      if (!requireAuth('record_recording', {
        page: 'circle_detail', entryId, dialectId: this.circle.dialect.id,
      })) return;
      goRecord({ entry_id: entryId, dialect_id: this.circle.dialect.id });
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

.record-button { margin-top: var(--space-3); }

.recording-list {
  min-height: 0;
  flex: 1;
}

.recording-list :deep(.recording-card) { margin-bottom: var(--space-3); }

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
  .state {
    transition: none;
  }
}
</style>
