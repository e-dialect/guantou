<template>
  <view class="recording-card">
    <view class="recording-card__meta">
      <text class="recording-card__dialect">
        {{ dialectText }}
      </text>
      <text class="recording-card__type">
        {{ typeText }}
      </text>
    </view>

    <view class="recording-card__title">
      {{ title }}
    </view>
    <view class="recording-card__gloss">
      {{ recording.original_gloss || '贡献者暂未补充大意' }}
    </view>

    <view
      v-if="pronunciationText"
      class="recording-card__pronunciation"
    >
      {{ pronunciationText }}
    </view>

    <view class="recording-card__actions">
      <BaseButton
        size="small"
        :text="playing ? '停止' : '听录音'"
        @click="toggleAudio"
      />
      <BaseButton
        v-if="entry"
        size="small"
        variant="ghost"
        text="看词条"
        @click="$emit('open-entry', entry.id)"
      />
    </view>

    <view
      v-if="entry"
      class="recording-card__community"
    >
      <BaseButton
        size="small"
        variant="ghost"
        :disabled="attested"
        :text="attested ? '已确认本地使用' : '我这里也这么说'"
        @click="$emit('attest', { entryId: entry.id, dialectId: recording.usage_dialect?.id })"
      />
      <BaseButton
        size="small"
        variant="ghost"
        text="录下我这边的说法"
        @click="$emit('continue', entry.id)"
      />
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import {
  dialectLabel,
  entryTitle,
  primaryEntryLink,
} from '@/services/entryRecording';
import { playManaged, stopAudio } from '@/utils/audio';

const TYPE_LABELS = {
  word: '词',
  phrase: '短语',
  example: '例句',
  other: '其他录音',
};

export default {
  name: 'EntryRecordingCard',
  components: { BaseButton },
  props: {
    recording: { type: Object, required: true },
    attested: { type: Boolean, default: false },
  },
  emits: ['attest', 'continue', 'open-entry'],
  data() {
    return {
      playing: false,
      playbackHandle: null,
    };
  },
  computed: {
    primaryLink() {
      return primaryEntryLink(this.recording);
    },
    entry() {
      return this.primaryLink?.entry || null;
    },
    title() {
      return entryTitle(this.entry || {});
    },
    dialectText() {
      return dialectLabel(this.recording.usage_dialect);
    },
    typeText() {
      return TYPE_LABELS[this.recording.recording_type] || TYPE_LABELS.other;
    },
    pronunciationText() {
      const variant = this.entry?.pronunciation_variants?.[0];
      return variant?.surface_romanization || variant?.base_romanization || variant?.ipa || '';
    },
  },
  beforeUnmount() {
    if (this.playbackHandle) stopAudio();
  },
  methods: {
    toggleAudio() {
      if (this.playing) {
        stopAudio();
        this.playing = false;
        this.playbackHandle = null;
        return;
      }
      this.playing = true;
      this.playbackHandle = playManaged(this.recording.audio_url, {
        onEnded: () => {
          this.playing = false;
          this.playbackHandle = null;
        },
        onError: () => {
          this.playing = false;
          this.playbackHandle = null;
          uni.showToast({ title: '录音播放失败', icon: 'none' });
        },
      });
      if (!this.playbackHandle) this.playing = false;
    },
  },
};
</script>

<style scoped>
.recording-card {
  padding: 30rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.recording-card__meta,
.recording-card__actions,
.recording-card__community {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.recording-card__meta {
  justify-content: space-between;
  color: var(--muted-color);
  font-size: 22rpx;
}

.recording-card__title {
  margin-top: 18rpx;
  color: var(--text-color);
  font-size: 42rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.recording-card__gloss {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  font-size: 28rpx;
  line-height: 1.65;
}

.recording-card__pronunciation {
  margin-top: 14rpx;
  color: var(--accent-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.recording-card__actions {
  margin-top: 24rpx;
}

.recording-card__community {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--border-color);
  flex-wrap: wrap;
}
</style>
