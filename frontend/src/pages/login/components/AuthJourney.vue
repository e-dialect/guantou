<template>
  <view class="auth-journey immersive-shell">
    <view class="auth-journey__hero">
      <view class="auth-journey__meta">
        <text class="auth-journey__eyebrow">
          {{ eyebrow }}
        </text>
        <view
          class="auth-journey__mark"
          aria-hidden="true"
        >
          {{ mark }}
        </view>
      </view>

      <view class="auth-journey__title">
        {{ title }}
      </view>
      <view class="auth-journey__lead">
        {{ lead }}
      </view>

      <view
        v-if="stepTotal > 0"
        class="auth-journey__progress"
        role="progressbar"
        :aria-label="progressAriaLabel"
        :aria-valuemin="1"
        :aria-valuemax="stepTotal"
        :aria-valuenow="safeStep"
      >
        <view class="auth-journey__progress-copy">
          <text>{{ stepLabel || `第 ${safeStep} 步` }}</text>
          <text>{{ safeStep }} / {{ stepTotal }}</text>
        </view>
        <view class="auth-journey__progress-track">
          <view
            class="auth-journey__progress-value"
            :style="{ width: progressWidth }"
          />
        </view>
      </view>

      <slot name="hero" />
    </view>

    <view class="auth-journey__sheet">
      <slot />
      <slot name="footer" />
    </view>
  </view>
</template>

<script>
export default {
  name: 'AuthJourney',
  props: {
    eyebrow: { type: String, default: '乡声通行证' },
    mark: { type: String, default: '乡' },
    title: { type: String, required: true },
    lead: { type: String, required: true },
    step: { type: Number, default: 0 },
    stepTotal: { type: Number, default: 0 },
    stepLabel: { type: String, default: '' },
  },
  computed: {
    safeStep() {
      if (this.stepTotal <= 0) return 0;
      return Math.min(Math.max(Number(this.step) || 1, 1), this.stepTotal);
    },
    progressWidth() {
      if (this.stepTotal <= 0) return '0%';
      return `${(this.safeStep / this.stepTotal) * 100}%`;
    },
    progressAriaLabel() {
      return `${this.stepLabel || '身份旅程'}：第 ${this.safeStep} 步，共 ${this.stepTotal} 步`;
    },
  },
};
</script>

<style scoped>
.auth-journey {
  width: 100%;
  max-width: 680rpx;
  margin: 28rpx auto 0;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-shadow: 0 24rpx 70rpx var(--border-color);
  overflow: hidden;
  box-sizing: border-box;
}

.auth-journey__hero {
  position: relative;
  padding: 40rpx 36rpx 34rpx;
  background:
    radial-gradient(circle at 88% 4%, var(--immersive-glow-color), transparent 34%),
    linear-gradient(
      150deg,
      var(--immersive-bg-strong-color),
      var(--immersive-bg-soft-color) 58%,
      var(--immersive-bg-color)
    );
  color: var(--on-immersive-color);
}

.auth-journey__meta,
.auth-journey__progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.auth-journey__eyebrow {
  color: var(--immersive-accent-color);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 5rpx;
}

.auth-journey__mark {
  width: 54rpx;
  height: 54rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-color);
  color: var(--on-immersive-color);
  font-family: STSong, SimSun, serif;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 54rpx;
  text-align: center;
}

.auth-journey__title {
  max-width: 520rpx;
  margin-top: 24rpx;
  font-family: STSong, SimSun, serif;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
  line-height: 1.2;
}

.auth-journey__lead {
  max-width: 540rpx;
  margin-top: 14rpx;
  color: var(--on-immersive-muted-color);
  font-size: 24rpx;
  line-height: 1.65;
}

.auth-journey__progress {
  margin-top: 26rpx;
}

.auth-journey__progress-copy {
  color: var(--on-immersive-muted-color);
  font-size: 20rpx;
  letter-spacing: 1rpx;
}

.auth-journey__progress-track {
  height: 5rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-strong-color);
  overflow: hidden;
}

.auth-journey__progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--immersive-accent-color);
}

.auth-journey__sheet {
  padding: 30rpx 34rpx 36rpx;
  background: var(--surface-color);
}

.auth-journey__sheet :deep(.auth-form) {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.auth-journey__sheet :deep(.code-row) {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
}

.auth-journey__sheet :deep(.code-field) {
  min-width: 0;
  flex: 1;
}

.auth-journey__sheet :deep(.code-button) {
  flex: 0 0 auto;
  margin-bottom: var(--space-3);
}

.auth-journey__sheet :deep(.auth-secondary) {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--border-color);
}
</style>
