<template>
  <view class="theme-journey-intro">
    <text class="theme-journey-intro__eyebrow">
      {{ eyebrow }}
    </text>
    <view class="theme-journey-intro__title">
      {{ title }}
    </view>
    <view
      v-if="description"
      class="theme-journey-intro__description"
    >
      {{ description }}
    </view>
    <view
      v-if="status"
      class="theme-journey-intro__status"
      :class="`theme-journey-intro__status--${tone}`"
    >
      {{ status }}
    </view>
  </view>
</template>

<script>
export default {
  name: 'ThemeJourneyIntro',
  props: {
    eyebrow: { type: String, default: '主题装扮' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, default: '' },
    tone: {
      type: String,
      default: 'neutral',
      validator: (value) => ['neutral', 'accent', 'warning', 'success'].includes(value),
    },
  },
};
</script>

<style scoped>
.theme-journey-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent-subtle-color), var(--surface-color));
}

.theme-journey-intro__eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.12em;
}

.theme-journey-intro__title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.theme-journey-intro__description {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.theme-journey-intro__status {
  display: inline-flex;
  max-width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  line-height: 1.45;
  box-sizing: border-box;
}

.theme-journey-intro__status--accent,
.theme-journey-intro__status--success {
  color: var(--accent-color);
}

.theme-journey-intro__status--warning {
  color: var(--warning-color);
}
</style>
