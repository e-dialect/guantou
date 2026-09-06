<template>
  <view class="account-setting-panel">
    <view class="account-setting-panel__intro">
      <view class="account-setting-panel__meta">
        <text class="account-setting-panel__eyebrow">
          {{ eyebrow }}
        </text>
        <view
          class="account-setting-panel__mark"
          aria-hidden="true"
        >
          {{ mark }}
        </view>
      </view>
      <view class="account-setting-panel__title">
        {{ title }}
      </view>
      <view class="account-setting-panel__description">
        {{ description }}
      </view>
    </view>

    <view class="account-setting-panel__body">
      <slot />
    </view>
  </view>
</template>

<script>
export default {
  name: 'AccountSettingPanel',
  props: {
    eyebrow: { type: String, default: '账户设置' },
    mark: { type: String, default: '我' },
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
};
</script>

<style scoped>
.account-setting-panel {
  width: 100%;
  max-width: 680rpx;
  margin: 24rpx auto 0;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  overflow: hidden;
  box-sizing: border-box;
}

.account-setting-panel__intro {
  padding: 30rpx 32rpx 28rpx;
  border-bottom: 1rpx solid var(--border-color);
  background: linear-gradient(145deg, var(--accent-subtle-color), var(--surface-color));
}

.account-setting-panel__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.account-setting-panel__eyebrow {
  color: var(--accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.account-setting-panel__mark {
  width: 52rpx;
  height: 52rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
  font-family: STSong, SimSun, serif;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 52rpx;
  text-align: center;
}

.account-setting-panel__title {
  margin-top: 18rpx;
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.3;
}

.account-setting-panel__description {
  margin-top: 10rpx;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.account-setting-panel__body {
  padding: 28rpx 32rpx 34rpx;
}
</style>
