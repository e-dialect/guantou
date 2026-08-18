<template>
  <view
    class="stage-card"
    :class="{ 'stage-card--active': active }"
  >
    <template v-if="active">
      <!-- 作者行 -->
      <view
        class="stage-card__head"
        @tap="openAuthor"
      >
        <image
          v-if="authorAvatar"
          class="stage-card__avatar"
          :src="authorAvatar"
          mode="aspectFill"
        />
        <view
          v-else
          class="stage-card__avatar stage-card__avatar--ghost"
        />
        <text class="stage-card__author">
          {{ authorName }}
        </text>
        <text
          v-if="dialectBadge"
          class="stage-card__badge"
        >
          {{ dialectBadge }}
        </text>
        <text
          class="stage-card__badge stage-card__badge--status"
          :data-status="can.status"
        >
          {{ statusText }}
        </text>
      </view>

      <!-- 播放舞台 -->
      <view class="stage-card__stage">
        <view
          class="stage-card__halo"
          :class="{ 'stage-card__halo--breathing': playing }"
        />
        <button
          class="play-button"
          :class="{ 'play-button--playing': playing }"
          :aria-label="playing ? '暂停播放' : '播放乡音'"
          @tap.stop="togglePlay"
        >
          <view
            v-if="playing"
            class="play-button__pause"
            aria-hidden="true"
          >
            <view class="play-button__pause-bar" />
            <view class="play-button__pause-bar" />
          </view>
          <view
            v-else
            class="play-button__triangle"
            aria-hidden="true"
          />
        </button>
        <view class="stage-card__wave">
          <AudioWave
            :playing="playing"
            :progress="progress"
          />
        </view>
        <view class="stage-card__time">
          <text
            v-if="playing"
            class="stage-card__time-current"
          >
            {{ formatSeconds(progressSeconds) }}
          </text>
          <text class="stage-card__time-total">
            {{ durationText }}
          </text>
        </view>
      </view>

      <!-- 铭牌区 -->
      <view class="stage-card__plates">
        <NameplateVoteRow
          v-if="primaryPreview"
          :nameplate="primaryPreview"
          :can-id="can.id"
        />
        <view
          v-if="!previews.length"
          class="stage-card__plates-empty"
        >
          这段乡音还没有铭牌。
        </view>
        <view
          v-if="extraCount > 0"
          class="stage-card__plates-more"
          @tap="openCanDetails"
        >
          + {{ extraCount }} 张铭牌 · 看详情 ›
        </view>
      </view>
    </template>

    <!-- 非激活态轻量占位 -->
    <view
      v-else
      class="stage-card__placeholder"
      aria-hidden="true"
    >
      <view class="stage-card__placeholder-dot" />
      <view class="stage-card__placeholder-line" />
    </view>
  </view>
</template>

<script>
import AudioWave from '@/components/home/AudioWave.vue';
import NameplateVoteRow from '@/components/home/NameplateVoteRow.vue';
import { getNameplatePreview } from '@/services/homeFeed';
import { goCanDetail } from '@/services/navigation';
import { playManaged, stopAudio } from '@/utils/audio';
import { toUserPage } from '@/routers/user';

const STATUS_LABELS = {
  unlabeled: '无铭牌',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '有争议',
  rejected: '已驳回',
};

export default {
  name: 'CanStageCard',
  components: {
    AudioWave,
    NameplateVoteRow,
  },
  props: {
    can: {
      type: Object,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      playing: false,
      progress: 0,
      progressSeconds: 0,
      previews: [],
      nameplateTotal: 0,
    };
  },
  computed: {
    authorName() {
      const recorder = this.can.recorder || {};
      return recorder.nickname || recorder.username || '匿名乡友';
    },
    authorAvatar() {
      return this.can.recorder ? this.can.recorder.avatar : '';
    },
    dialectBadge() {
      return this.can.submitted_dialect?.qualified_code || '';
    },
    statusText() {
      return STATUS_LABELS[this.can.status] || this.can.status || '未知';
    },
    durationText() {
      const durationMs = Number(this.can.duration_ms || 0);
      if (!durationMs) return '未知时长';
      return `${Math.max(1, Math.round(durationMs / 1000))}″`;
    },
    extraCount() {
      return Math.max(0, this.nameplateTotal - (this.primaryPreview ? 1 : 0));
    },
    primaryPreview() {
      const previews = this.previews || [];
      return previews.find((plate) => plate.is_primary) || previews[0] || null;
    },
  },
  watch: {
    active(next) {
      if (next) this.ensurePreviews();
      else this.stopPlayback();
    },
    can: {
      deep: true,
      handler() {
        this.ensurePreviews();
      },
    },
  },
  mounted() {
    if (this.active) this.ensurePreviews();
  },
  activated() {
    if (this.active) this.ensurePreviews();
  },
  beforeUnmount() {
    this.stopPlayback();
  },
  methods: {
    formatSeconds(seconds) {
      const total = Math.max(0, Math.floor(seconds));
      return `${total}″`;
    },
    ensurePreviews() {
      const { previews, total } = getNameplatePreview(this.can.id, this.can);
      this.previews = previews;
      this.nameplateTotal = total;
    },
    togglePlay() {
      if (!this.can.audio_url) {
        uni.showToast({ title: '暂无可播放音频', icon: 'none' });
        return;
      }
      if (this.playing) {
        this.stopPlayback();
        return;
      }
      this.progress = 0;
      this.progressSeconds = 0;
      this.playing = true;
      playManaged(this.can.audio_url, {
        onTimeUpdate: ({ currentTime, duration }) => {
          this.progressSeconds = currentTime;
          if (duration > 0) {
            this.progress = Math.min(1, currentTime / duration);
          }
        },
        onEnded: () => {
          this.playing = false;
          this.progress = 0;
          this.progressSeconds = 0;
        },
        onError: () => {
          this.playing = false;
          this.progress = 0;
          this.progressSeconds = 0;
          uni.showToast({ title: '播放失败', icon: 'none' });
        },
      });
    },
    stopPlayback() {
      if (this.playing) {
        stopAudio();
      }
      this.playing = false;
      this.progress = 0;
      this.progressSeconds = 0;
    },
    openAuthor() {
      if (this.can.recorder && this.can.recorder.id) {
        toUserPage(this.can.recorder.id);
      }
    },
    openCanDetails() {
      goCanDetail(this.can.id);
    },
  },
};
</script>

<style scoped>
.stage-card {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 32rpx 32rpx 48rpx;
}

/* ---------- 作者行 ---------- */
.stage-card__head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.stage-card__avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 2rpx solid var(--immersive-border-color);
  background: var(--immersive-surface-color);
}

.stage-card__avatar--ghost {
  opacity: 0.5;
}

.stage-card__author {
  min-width: 0;
  flex: 0 1 auto;
  color: var(--on-immersive-color);
  font-size: var(--font-size-base);
  font-weight: 800;
  letter-spacing: 1rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-card__badge {
  flex: 0 0 auto;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  border: 1rpx solid var(--immersive-border-color);
  background: var(--immersive-surface-color);
  color: var(--on-immersive-muted-color);
  font-size: 20rpx;
  letter-spacing: 1rpx;
}

.stage-card__badge--status {
  color: var(--immersive-accent-color);
  border-color: var(--immersive-accent-color);
}

/* ---------- 播放舞台 ---------- */
.stage-card__stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 0 24rpx;
}

.stage-card__halo {
  position: absolute;
  top: 34rpx;
  width: 260rpx;
  height: 260rpx;
  border-radius: 50%;
  background: radial-gradient(circle, var(--immersive-glow-color) 0%, transparent 70%);
  opacity: 0.55;
  transition: opacity 0.5s ease;
}

.stage-card__halo--breathing {
  opacity: 1;
  animation: halo-breath 2.4s ease-in-out infinite;
}

.play-button {
  position: relative;
  z-index: 1;
  width: 156rpx;
  height: 156rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 2rpx solid var(--immersive-border-color);
  background: var(--immersive-surface-strong-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, background-color 0.3s ease;
}

.play-button::after {
  border: 0;
}

.play-button:active {
  transform: scale(0.92);
}

.play-button--playing {
  background: var(--immersive-accent-color);
  border-color: var(--immersive-accent-color);
}

.play-button__triangle {
  width: 0;
  height: 0;
  margin-left: 10rpx;
  border-left: 44rpx solid var(--on-immersive-color);
  border-top: 26rpx solid transparent;
  border-bottom: 26rpx solid transparent;
}

.play-button--playing .play-button__triangle {
  border-left-color: var(--immersive-bg-color);
}

.play-button__pause {
  display: flex;
  gap: 16rpx;
}

.play-button__pause-bar {
  width: 14rpx;
  height: 52rpx;
  border-radius: 6rpx;
  background: var(--immersive-bg-color);
}

.stage-card__wave {
  width: 100%;
  margin-top: 40rpx;
}

.stage-card__time {
  margin-top: 14rpx;
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
  letter-spacing: 2rpx;
}

.stage-card__time-current {
  color: var(--immersive-accent-color);
  font-weight: 700;
}

/* ---------- 概念文字 ---------- */
.stage-card__concept {
  margin-top: 40rpx;
}

.stage-card__concept-quote {
  display: block;
  color: var(--on-immersive-color);
  font-size: 56rpx;
  font-weight: 900;
  line-height: 1.24;
  letter-spacing: 3rpx;
  overflow-wrap: anywhere;
}

.stage-card__concept-hint {
  display: block;
  margin-top: 12rpx;
  color: var(--on-immersive-faint-color);
  font-size: 20rpx;
  letter-spacing: 4rpx;
}

/* ---------- 铭牌区 ---------- */
.stage-card__plates {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.stage-card__plates-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.stage-card__plates-line {
  height: 76rpx;
  border-radius: var(--radius-md);
  background: linear-gradient(
    100deg,
    var(--immersive-skeleton-color) 30%,
    var(--immersive-skeleton-highlight-color) 50%,
    var(--immersive-skeleton-color) 70%
  );
  background-size: 200% 100%;
  animation: immersive-shimmer 1.4s linear infinite;
}

.stage-card__plates-empty {
  padding: 20rpx 22rpx;
  border-radius: var(--radius-md);
  border: 1rpx dashed var(--immersive-border-color);
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
  text-align: center;
}

.stage-card__plates-more {
  align-self: flex-start;
  padding: 10rpx 22rpx;
  border-radius: var(--radius-pill);
  color: var(--immersive-accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1rpx;
  background: var(--immersive-surface-color);
  border: 1rpx solid var(--immersive-border-color);
}

/* ---------- 非激活占位 ---------- */
.stage-card__placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 22rpx;
  opacity: 0.5;
}

.stage-card__placeholder-dot {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  border: 2rpx solid var(--immersive-border-color);
}

.stage-card__placeholder-line {
  width: 200rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--immersive-skeleton-color);
}

@keyframes halo-breath {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.7;
  }

  50% {
    transform: scale(1.12);
    opacity: 1;
  }
}

@keyframes immersive-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage-card__halo--breathing,
  .stage-card__plates-line {
    animation: none;
  }
}
</style>
