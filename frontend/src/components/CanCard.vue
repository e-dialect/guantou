<template>
  <view
    class="can-card"
    @tap="$emit('open', can.id)"
  >
    <view class="card-head">
      <text class="label">
        {{ primaryText }}
      </text>
      <text class="status">
        {{ statusText(can.status) }}
      </text>
    </view>
    <view class="concept">
      {{ can.concept_text || '未填写普通话概念' }}
    </view>
    <view class="meta">
      {{ locationText }} · {{ nameplateCount }} 张铭牌 · {{ can.views || 0 }} 次查看
    </view>
    <button
      class="play-button"
      :disabled="!can.audio_url"
      @tap.stop="play"
    >
      <text class="play-icon">
        ▶
      </text>
      <text>{{ can.audio_url ? `听乡音${durationText}` : '暂无可播放音频' }}</text>
    </button>
  </view>
</template>

<script>
import { playAudio } from '@/utils/audio';

const statusLabels = {
  unlabeled: '无铭牌',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '有争议',
  rejected: '已驳回',
};

export default {
  name: 'CanCard',
  props: {
    can: {
      type: Object,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    primaryText() {
      return this.can.primary_nameplate
        ? this.can.primary_nameplate.display_text
        : '等待铭牌';
    },
    locationText() {
      return this.can.submitted_dialect?.qualified_code || '未标方言点';
    },
    nameplateCount() {
      return this.can.nameplate_count || 0;
    },
    durationText() {
      const durationMs = Number(this.can.duration_ms || 0);
      if (!durationMs) return '';
      return ` · ${Math.max(1, Math.round(durationMs / 1000))} 秒`;
    },
  },
  methods: {
    play() {
      playAudio(this.can.audio_url);
    },
    statusText(status) {
      return statusLabels[status] || status || '未知';
    },
  },
};
</script>

<style scoped>
.can-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.label {
  min-width: 0;
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.status {
  flex: 0 0 auto;
  font-size: 24rpx;
  color: #1f5c43;
  background: #e8f1eb;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.concept {
  margin-top: 14rpx;
  color: #33463b;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}

.play-button {
  width: 100%;
  min-height: 68rpx;
  margin: 20rpx 0 0;
  padding: 0 20rpx;
  border: 1px solid #cbd8cb;
  border-radius: 999rpx;
  background: #f4f8f3;
  color: #1f5c43;
  font-size: 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.play-button::after {
  border: 0;
}

.play-button[disabled] {
  background: #f2f3ef;
  color: #899289;
  border-color: #e2e5df;
}

.play-icon {
  font-size: 20rpx;
}
</style>
