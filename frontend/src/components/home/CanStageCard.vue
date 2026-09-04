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

      <!-- 铭牌区：主铭牌 + 最多 2 张副铭牌（紧凑形态） -->
      <view class="stage-card__plates">
        <NameplateVoteRow
          v-for="(plate, index) in platePreviews"
          :key="plate.id"
          :nameplate="plate"
          :can-id="can.id"
          :compact="index > 0"
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
import {
  onExternalStop, playManaged, stopAudio,
} from '@/utils/audio';
import { toUserPage } from '@/routers/user';
import { dialectCardLabel } from '@/utils/dialectTree';

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
      return this.can.submitted_dialect ? dialectCardLabel(this.can.submitted_dialect) : '';
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
      return Math.max(0, this.nameplateTotal - this.platePreviews.length);
    },
    /* 主铭牌排首位，副铭牌随其后，总共最多渲染 3 张 */
    platePreviews() {
      const previews = this.previews || [];
      if (!previews.length) return [];
      const primary = previews.find((plate) => plate.is_primary) || previews[0];
      const rest = previews.filter((plate) => plate !== primary);
      return [primary, ...rest].slice(0, 3);
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
  created() {
    /* 播放句柄不进 data：需与外部停止广播携带的句柄做全等比较，
     * 被响应式代理包装后引用不相等会导致归属判断失效 */
    this.playbackHandle = null;
  },
  mounted() {
    if (this.active) this.ensurePreviews();
    /* 订阅外部停止广播：切 tab/跳详情/被其他播放顶掉时复位本地播放态 */
    this.unsubscribeExternalStop = onExternalStop(this.resetPlaybackState);
  },
  activated() {
    if (this.active) this.ensurePreviews();
  },
  beforeUnmount() {
    this.stopPlayback();
    if (this.unsubscribeExternalStop) {
      this.unsubscribeExternalStop();
      this.unsubscribeExternalStop = null;
    }
  },
  methods: {
    /* 外部停止回调：只复位本地展示态，不得再调 stopAudio（避免递归）。
     * 广播携带被停止句柄：不属于本卡时忽略——否则本卡发起置换播放时，
     * 先置 playing 再调 playManaged 的顺序会被旧句柄的停止广播误复位 */
    resetPlaybackState(stoppedHandle) {
      if (stoppedHandle && stoppedHandle !== this.playbackHandle) return;
      this.playbackHandle = null;
      this.playing = false;
      this.progress = 0;
      this.progressSeconds = 0;
    },
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
      this.playbackHandle = playManaged(this.can.audio_url, {
        onTimeUpdate: ({ currentTime, duration }) => {
          this.progressSeconds = currentTime;
          if (duration > 0) {
            this.progress = Math.min(1, currentTime / duration);
          }
        },
        onEnded: () => {
          this.resetPlaybackState();
        },
        onError: () => {
          this.resetPlaybackState();
          uni.showToast({ title: '播放失败', icon: 'none' });
        },
      });
    },
    stopPlayback() {
      if (this.playing) {
        stopAudio();
      }
      this.resetPlaybackState();
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
  /* 副铭牌恢复操作条后内容变高：上下内边距收紧一档，底部交给 body 的
   * padding-bottom（118rpx）避开 TabBar，卡片自身只需少量呼吸留白 */
  padding: 24rpx 32rpx 28rpx;
}

/* 三大纵向区块禁止 flex 收缩：一旦内容超出可用高度（超长释义等极端情况），
 * 溢出从顶部（作者行/舞台上方）被裁切，而非铭牌底部被挤成半张 ——
 * 这正是「第二张副铭牌显示不全」截断 bug 的成因（flex 默认 shrink=1） */
.stage-card__head,
.stage-card__stage,
.stage-card__plates {
  flex: 0 0 auto;
}

/* 激活态：占位圆点 → 完整卡切换时整卡淡入，
 * 不与子元素 halo 呼吸动画冲突；非激活占位态无动画 */
.stage-card--active {
  animation: stage-card-enter 0.2s ease-out;
}

@keyframes stage-card-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage-card--active {
    animation: none;
  }
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
  /* 铭牌区增至 3 张且副铭牌带操作条，舞台上下留白再收紧一档保层次；
   * 播放按钮仍为视觉主角（140rpx），详见 Issue #218 布局预算 */
  padding: 28rpx 0 16rpx;
}

.stage-card__halo {
  position: absolute;
  top: 16rpx;
  width: 224rpx;
  height: 224rpx;
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
  width: 140rpx;
  height: 140rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 2rpx solid var(--immersive-border-color);
  background: var(--immersive-surface-strong-color);
  /* 内侧顶部高光：低成本提升玻璃质感 */
  box-shadow: inset 0 3rpx 8rpx var(--immersive-surface-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease;
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
  /* 播放中外圈柔光，与 halo 呼吸呼应 */
  box-shadow:
    inset 0 3rpx 8rpx var(--immersive-surface-color),
    0 0 28rpx var(--immersive-glow-color);
}

.play-button__triangle {
  width: 0;
  height: 0;
  margin-left: 9rpx;
  border-left: 40rpx solid var(--on-immersive-color);
  border-top: 24rpx solid transparent;
  border-bottom: 24rpx solid transparent;
  /* 单层投影增加立体感，比多层 border 造型更廉价 */
  filter: drop-shadow(0 2rpx 4rpx var(--immersive-bg-color));
}

.play-button--playing .play-button__triangle {
  border-left-color: var(--immersive-bg-color);
}

.play-button__pause {
  display: flex;
  gap: 16rpx;
}

.play-button__pause-bar {
  width: 12rpx;
  height: 46rpx;
  border-radius: 6rpx;
  background: var(--immersive-bg-color);
}

.stage-card__wave {
  width: 100%;
  margin-top: 24rpx;
}

.stage-card__time {
  margin-top: 10rpx;
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

/* ---------- 铭牌区 ---------- */
.stage-card__plates {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.stage-card__plates-empty {
  padding: 20rpx 22rpx;
  border-radius: var(--radius-md);
  border: 1rpx dashed var(--immersive-border-color);
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
  text-align: center;
}

/* 全宽收尾入口：与上方铭牌卡同宽，右缘对齐避免锯齿 */
.stage-card__plates-more {
  align-self: stretch;
  padding: 10rpx 22rpx;
  border-radius: var(--radius-pill);
  color: var(--immersive-accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1rpx;
  background: var(--immersive-surface-color);
  border: 1rpx solid var(--immersive-border-color);
  text-align: center;
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

@media (prefers-reduced-motion: reduce) {
  .stage-card__halo--breathing {
    animation: none;
  }
}
</style>
