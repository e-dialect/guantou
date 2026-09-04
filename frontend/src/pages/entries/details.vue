<template>
  <PageShell title="词条详情">
    <BaseLoading
      v-if="loading"
      text="正在读取词条…"
    />
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      action-text="重试"
      @action="load"
    />
    <view
      v-else-if="entry"
      class="entry-detail"
    >
      <view class="entry-hero">
        <view class="entry-hero__meta">
          <text>{{ dialectLabel(entry.usage_dialect) }}</text>
          <text>{{ statusLabel(entry.status) }}</text>
        </view>
        <view class="entry-hero__title">
          {{ entryTitle(entry) }}
        </view>
        <view class="entry-hero__summary">
          {{ entry.summary || '大意待补充' }}
        </view>
        <view
          v-if="entry.identity_note"
          class="entry-identity"
        >
          辨识说明：{{ entry.identity_note }}
        </view>
        <view class="entry-hero__counts">
          <text>{{ entry.recording_count }} 段录音</text>
          <text>{{ entry.attestation_count }} 次地区确认</text>
          <text>{{ entry.evidence_count }} 条证据</text>
        </view>
        <view
          v-if="entry.needs_audio"
          class="needs-audio"
        >
          这个词条还没有录音，但它仍是一条有效词条。你可以补上第一段乡音。
        </view>
      </view>

      <view
        v-if="entry.senses?.length"
        class="detail-section"
      >
        <view class="detail-section__title">
          编号义与用法
        </view>
        <view
          v-for="sense in entry.senses"
          :key="sense.id"
          class="sense-row"
        >
          <text class="sense-row__number">
            {{ sense.sense_number }}
          </text>
          <view>
            <view class="sense-row__gloss">
              {{ sense.gloss }}
            </view>
            <view
              v-if="sense.usage_note"
              class="sense-row__note"
            >
              {{ sense.usage_note }}
            </view>
            <view
              v-if="sense.concepts?.length"
              class="sense-row__concepts"
            >
              关联概念：{{ sense.concepts.map((item) => item.label || item.code).join('、') }}
            </view>
          </view>
        </view>
      </view>

      <view
        v-if="entry.writings?.length"
        class="detail-section"
      >
        <view class="detail-section__title">
          写法
        </view>
        <view class="chip-list">
          <view
            v-for="writing in entry.writings"
            :key="writing.id"
            class="detail-chip"
          >
            {{ writing.writing.text }} · {{ writingTypeLabel(writing.writing.form_type) }}
          </view>
        </view>
      </view>

      <view
        v-if="entry.pronunciation_variants?.length"
        class="detail-section"
      >
        <view class="detail-section__title">
          地区间读音差异
        </view>
        <view
          v-for="variant in entry.pronunciation_variants"
          :key="variant.id"
          class="pronunciation-row"
        >
          <view class="pronunciation-row__dialect">
            {{ dialectLabel(variant.dialect) }}
          </view>
          <view class="pronunciation-row__value">
            {{ variant.surface_romanization || variant.base_romanization || variant.ipa }}
          </view>
          <view
            v-if="variant.ipa"
            class="pronunciation-row__ipa"
          >
            IPA {{ variant.ipa }}
          </view>
        </view>
      </view>

      <view class="detail-section">
        <view class="detail-section__heading">
          <view>
            <view class="detail-section__title">
              关联录音
            </view>
            <view class="detail-section__copy">
              同一词条可有多个地区读音和多段录音。
            </view>
          </view>
          <BaseButton
            size="small"
            text="录下我这边的说法"
            @click="continueChain"
          />
        </view>
        <EmptyState
          v-if="!recordings.length"
          title="还没有可听的录音"
          action-text="补第一段录音"
          @action="continueChain"
        />
        <view
          v-else
          class="recording-list"
        >
          <EntryRecordingCard
            v-for="recording in recordings"
            :key="recording.id"
            :recording="recording"
            :attested="attestedDialects.has(recording.usage_dialect?.id)"
            @attest="attest"
            @continue="continueChain"
          />
        </view>
      </view>
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
import {
  createUsageAttestation,
  dialectLabel,
  entryTitle,
  getEntry,
  listRecordings,
  pageResults,
} from '@/services/entryRecording';
import { notifySuccess } from '@/services/feedback';
import { goRecord } from '@/services/navigation';

export default {
  components: {
    BaseButton,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
    PageShell,
  },
  data() {
    return {
      id: null,
      entry: null,
      recordings: [],
      loading: true,
      errorMessage: '',
      attestedDialects: new Set(),
    };
  },
  onLoad(options = {}) {
    this.id = Number(options.id) || null;
    this.load();
  },
  onShow() {
    if (this.id && this.entry) this.load();
  },
  methods: {
    dialectLabel,
    entryTitle,
    statusLabel(status) {
      return {
        draft: '初稿',
        reviewed: '已整理',
        disputed: '有分歧',
        redirected: '已合并跳转',
      }[status] || '待整理';
    },
    writingTypeLabel(type) {
      return {
        orthographic: '汉字正字',
        popular: '俗写',
        loan: '借字',
        phonetic: '拟音',
        romanization: '罗马字',
        uncertain: '待考写法',
      }[type] || '其他写法';
    },
    async load() {
      if (!this.id) {
        this.loading = false;
        this.errorMessage = '缺少词条编号';
        return;
      }
      this.loading = true;
      this.errorMessage = '';
      try {
        const [entry, recordings] = await Promise.all([
          getEntry(this.id),
          listRecordings({ entry_id: this.id, page_size: 50 }),
        ]);
        this.entry = entry;
        this.recordings = pageResults(recordings);
      } catch (error) {
        this.errorMessage = '词条暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    continueChain() {
      if (!requireAuth('record_recording', { page: 'entry_detail', entryId: this.id })) return;
      goRecord({ entry_id: this.id });
    },
    async attest({ dialectId }) {
      if (!dialectId) return;
      if (!requireAuth('attest_usage', { page: 'entry_detail', entryId: this.id })) return;
      try {
        await createUsageAttestation(this.id, dialectId);
        this.attestedDialects = new Set([...this.attestedDialects, dialectId]);
        this.entry.attestation_count = Number(this.entry.attestation_count || 0) + 1;
        notifySuccess({ title: '已记下你这里也这么说' });
      } catch (error) {
        uni.showToast({ title: error.message || '确认失败，请稍后再试', icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.entry-detail,
.recording-list {
  display: grid;
  gap: 24rpx;
}

.entry-hero,
.detail-section {
  padding: 28rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.entry-hero__meta,
.entry-hero__counts,
.detail-section__heading {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  flex-wrap: wrap;
}

.entry-hero__meta,
.entry-hero__counts,
.detail-section__copy,
.sense-row__note,
.sense-row__concepts,
.pronunciation-row__ipa {
  color: var(--muted-color);
  font-size: 22rpx;
}

.entry-hero__title {
  margin-top: 18rpx;
  font-size: 48rpx;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.entry-hero__summary,
.entry-identity {
  margin-top: 14rpx;
  color: var(--text-secondary-color);
  line-height: 1.65;
}

.entry-hero__counts {
  margin-top: 20rpx;
}

.needs-audio {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.detail-section__title {
  font-size: 30rpx;
  font-weight: 800;
}

.detail-section__heading {
  align-items: flex-start;
}

.sense-row,
.pronunciation-row {
  display: flex;
  gap: 18rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border-color);
}

.sense-row__number {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-weight: 900;
}

.sense-row__gloss,
.pronunciation-row__value {
  font-weight: 700;
}

.sense-row__note,
.sense-row__concepts,
.pronunciation-row__ipa {
  margin-top: 8rpx;
  line-height: 1.5;
}

.chip-list {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.detail-chip {
  padding: 10rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: 22rpx;
}

.pronunciation-row {
  display: grid;
  grid-template-columns: minmax(120rpx, auto) 1fr;
}

.pronunciation-row__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.pronunciation-row__ipa {
  grid-column: 2;
}
</style>
