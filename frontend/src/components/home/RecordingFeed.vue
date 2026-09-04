<template>
  <scroll-view
    scroll-y
    class="recording-feed"
    @scrolltolower="loadMore"
  >
    <view class="recording-feed__intro">
      <text class="recording-feed__kicker">
        听见真实使用
      </text>
      <text class="recording-feed__title">
        一段录音，可以通向一个词条
      </text>
      <text class="recording-feed__copy">
        不知道汉字也没关系：先听、先确认，再由爱好者补充写法和读音。
      </text>
    </view>

    <BaseLoading
      v-if="loading && !items.length"
      text="正在寻找乡音…"
    />
    <EmptyState
      v-else-if="errorMessage && !items.length"
      :title="errorMessage"
      action-text="重试"
      @action="reload"
    />
    <EmptyState
      v-else-if="!items.length"
      title="这里还没有可听的录音"
      action-text="录下第一段"
      @action="openRecorder"
    />
    <view
      v-else
      class="recording-feed__list"
    >
      <EntryRecordingCard
        v-for="recording in items"
        :key="recording.id"
        :recording="recording"
        :attested="attestedEntries.has(primaryEntryId(recording))"
        @open-entry="goEntryDetail"
        @attest="attest"
        @continue="continueChain"
      />
      <BaseLoading
        v-if="loadingMore"
        text="继续加载…"
      />
      <view
        v-else-if="!next && items.length"
        class="recording-feed__end"
      >
        已经听到这一页的末尾
      </view>
    </view>
  </scroll-view>
</template>

<script>
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createUsageAttestation,
  listRecordings,
  pageResults,
  primaryEntryLink,
} from '@/services/entryRecording';
import { notifySuccess } from '@/services/feedback';
import {
  goEntryDetail,
  goRecord,
} from '@/services/navigation';

export default {
  name: 'RecordingFeed',
  components: { BaseLoading, EmptyState, EntryRecordingCard },
  props: {
    tab: { type: String, default: 'recommended' },
  },
  data() {
    return {
      items: [],
      next: null,
      page: 1,
      loading: false,
      loadingMore: false,
      errorMessage: '',
      attestedEntries: new Set(),
    };
  },
  created() {
    this.reload();
  },
  methods: {
    primaryEntryId(recording) {
      return primaryEntryLink(recording)?.entry?.id || null;
    },
    query(page = 1) {
      const params = { page, page_size: 12 };
      const app = typeof getApp === 'function' ? getApp() : null;
      const primaryDialect = app?.globalData?.userInfo?.primary_dialect;
      if (this.tab === 'today') params.page_size = 1;
      if (this.tab === 'following') params.recording_type = 'phrase';
      if (this.tab === 'dialect' && primaryDialect?.id) {
        params.dialect_id = primaryDialect.id;
        params.dialect_match = 'subtree';
      }
      return params;
    },
    async reload() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const response = await listRecordings(this.query(1));
        this.items = pageResults(response);
        this.next = response?.next || null;
        this.page = 1;
      } catch (error) {
        this.errorMessage = '录音加载失败，请稍后重试';
      } finally {
        this.loading = false;
      }
    },
    async loadMore() {
      if (!this.next || this.loadingMore) return;
      this.loadingMore = true;
      try {
        const page = this.page + 1;
        const response = await listRecordings(this.query(page));
        this.items = [...this.items, ...pageResults(response)];
        this.next = response?.next || null;
        this.page = page;
      } catch (error) {
        uni.showToast({ title: '暂时无法继续加载', icon: 'none' });
      } finally {
        this.loadingMore = false;
      }
    },
    goEntryDetail,
    openRecorder() {
      if (!requireAuth('record_recording', { page: 'listen' })) return;
      goRecord();
    },
    continueChain(entryId) {
      if (!requireAuth('record_recording', { page: 'listen', entryId })) return;
      goRecord({ entry_id: entryId });
    },
    async attest({ entryId, dialectId }) {
      if (!entryId || !dialectId) return;
      if (!requireAuth('attest_usage', { page: 'listen', entryId })) return;
      try {
        await createUsageAttestation(entryId, dialectId);
        this.attestedEntries = new Set([...this.attestedEntries, entryId]);
        notifySuccess({ title: '已记下你这里也这么说' });
      } catch (error) {
        uni.showToast({ title: error.message || '确认失败，请稍后再试', icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.recording-feed {
  height: 100%;
}

.recording-feed__intro {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 30rpx;
  color: var(--on-immersive-color);
}

.recording-feed__kicker {
  color: var(--immersive-accent-color);
  font-size: 22rpx;
  font-weight: 800;
}

.recording-feed__title {
  font-size: 38rpx;
  font-weight: 800;
}

.recording-feed__copy {
  color: var(--on-immersive-muted-color);
  font-size: 25rpx;
  line-height: 1.6;
}

.recording-feed__list {
  display: grid;
  gap: 22rpx;
  padding: 0 24rpx 180rpx;
}

.recording-feed__end {
  padding: 24rpx;
  color: var(--on-immersive-muted-color);
  text-align: center;
  font-size: 22rpx;
}
</style>
