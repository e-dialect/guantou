<template>
  <view class="theme-switcher">
    <view class="theme-heading">
      <view>
        <view class="theme-title">
          外观主题
        </view>
        <view class="theme-copy">
          H5 与小程序会分别记住你的选择
        </view>
      </view>
      <text class="theme-current">
        {{ currentLabel }}
      </text>
    </view>
    <view class="theme-options">
      <button
        v-for="option in options"
        :key="option.value"
        class="theme-option"
        :class="{ active: preference === option.value }"
        @tap="selectTheme(option.value)"
      >
        {{ option.label }}
      </button>
    </view>
  </view>
</template>

<script>
import {
  applyTheme,
  getThemePreference,
  setThemePreference,
  THEME_OPTIONS,
} from '@/services/theme';

export default {
  name: 'ThemeSwitcher',
  data() {
    return {
      options: THEME_OPTIONS,
      preference: getThemePreference(),
    };
  },
  computed: {
    currentLabel() {
      return this.options.find((option) => option.value === this.preference)?.label;
    },
  },
  mounted() {
    applyTheme(this.preference);
  },
  methods: {
    selectTheme(preference) {
      this.preference = setThemePreference(preference).preference;
    },
  },
};
</script>

<style scoped>
.theme-switcher {
  margin-top: 28rpx;
  padding: 26rpx;
  border: 1px solid var(--border-color, #e1e6dc);
  border-radius: 14rpx;
  background: var(--surface-color, #ffffff);
}

.theme-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.theme-title {
  font-size: 29rpx;
  font-weight: 700;
}

.theme-copy,
.theme-current {
  color: var(--muted-color, #6c776e);
  font-size: 23rpx;
}

.theme-copy {
  margin-top: 6rpx;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.theme-option {
  margin: 0;
  padding: 0 8rpx;
  border: 1px solid var(--border-color, #d9e0d6);
  border-radius: 999rpx;
  background: var(--surface-color, #ffffff);
  color: var(--text-color, #1d2a24);
  font-size: 24rpx;
  line-height: 62rpx;
}

.theme-option::after {
  border: 0;
}

.theme-option.active {
  border-color: var(--accent-color, #1f5c43);
  background: var(--accent-color, #1f5c43);
  color: #ffffff;
}
</style>
