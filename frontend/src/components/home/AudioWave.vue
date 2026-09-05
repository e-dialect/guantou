<template>
  <view
    class="audio-wave"
    :class="{ 'audio-wave--playing': playing }"
    :style="{ '--wave-progress': safeProgress }"
  >
    <view
      v-for="(bar, index) in BARS"
      :key="index"
      class="audio-wave__bar"
      :class="{ 'audio-wave__bar--lit': litUpTo > index }"
      :style="{
        '--bar-height': `${bar}%`,
        '--bar-delay': `${barDelays[index]}s`,
        '--bar-duration': `${barDurations[index]}s`,
      }"
    />
  </view>
</template>

<script>
/* 固定伪随机高度/相位序列，保证双端视觉一致且每次渲染稳定 */
const BARS = [
  34, 58, 42, 76, 52, 88, 64, 40, 72, 96,
  55, 80, 38, 66, 92, 48, 74, 58, 86, 44,
  70, 98, 52, 62, 36, 56,
];
const BAR_DELAYS = BARS.map((_, index) => -(((index * 137) % 100) / 100));
const BAR_DURATIONS = BARS.map((height, index) => 0.9 + (((height + index * 53) % 60) / 100));

export default {
  name: 'AudioWave',
  props: {
    playing: {
      type: Boolean,
      default: false,
    },
    progress: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      BARS,
      barDelays: BAR_DELAYS,
      barDurations: BAR_DURATIONS,
    };
  },
  computed: {
    safeProgress() {
      return Math.min(1, Math.max(0, Number(this.progress) || 0));
    },
    litUpTo() {
      if (!this.playing || this.safeProgress <= 0) return -1;
      return Math.floor(this.safeProgress * BARS.length);
    },
  },
};
</script>

<style scoped>
.audio-wave {
  position: relative;
  display: flex;
  align-items: center;
  /* 紧凑录音卡布局预算下收紧一档。 */
  height: 84rpx;
  width: 100%;
}

/* 播放光晕改为单个渐变底层：比逐条 box-shadow 模糊便宜得多，
 * 低端机不需要为 26 条波形各自计算投影，观感保持 */
.audio-wave::before {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  top: 50%;
  height: 64rpx;
  transform: translateY(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse, var(--immersive-glow-color) 0%, transparent 75%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.audio-wave--playing::before {
  opacity: 1;
}

.audio-wave__bar {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 4rpx;
  height: calc(var(--bar-height) * 1%);
  min-height: 10rpx;
  border-radius: 999rpx;
  background: var(--immersive-wave-color);
  transform: scaleY(0.32);
  transform-origin: center;
  animation-name: wave-pulse;
  animation-duration: var(--bar-duration);
  animation-timing-function: ease-in-out;
  animation-delay: var(--bar-delay);
  animation-iteration-count: infinite;
  animation-play-state: paused;
  transition: background-color 0.35s ease;
}

.audio-wave--playing .audio-wave__bar {
  animation-play-state: running;
}

/* 点亮条不再自带 box-shadow，发光感由底层渐变统一提供 */
.audio-wave__bar--lit {
  background: var(--immersive-wave-active-color);
}

@keyframes wave-pulse {
  0%,
  100% {
    transform: scaleY(0.32);
  }

  50% {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audio-wave__bar {
    animation: none;
    transform: scaleY(0.7);
  }
}
</style>
