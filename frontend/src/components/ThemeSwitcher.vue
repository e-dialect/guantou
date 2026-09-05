<template>
  <view class="theme-studio">
    <view class="theme-heading">
      <view>
        <view class="theme-title">
          主题
        </view>
        <view class="theme-copy">
          先选一套风格，再单独搭配主按钮、次按钮和特效。下面两个预览会立刻变。
        </view>
      </view>
    </view>

    <view class="theme-preview">
      <BaseButton
        class="theme-preview-btn"
        size="small"
      >
        装一罐
      </BaseButton>
      <BaseButton
        class="theme-preview-btn"
        variant="ghost"
        size="small"
      >
        编辑资料
      </BaseButton>
    </view>

    <view class="theme-kicker">
      风格套装
    </view>
    <view class="pack-options">
      <view
        v-for="option in packOptions"
        :key="option.value"
        class="pack-choice pressable"
        :class="{ active: pack === option.value }"
        @tap="selectPack(option.value)"
      >
        {{ option.label }}
      </view>
    </view>

    <view class="theme-heading accent-heading">
      <view>
        <view class="theme-title">
          外观
        </view>
        <view class="theme-copy">
          浅色、深色可跟随系统。H5 与小程序会分别记住。
        </view>
      </view>
      <text class="theme-current">
        {{ currentThemeLabel }}
      </text>
    </view>
    <view class="theme-options">
      <view
        v-for="option in themeOptions"
        :key="option.value"
        class="theme-option pressable"
        :class="{ active: preference === option.value }"
        @tap="selectTheme(option.value)"
      >
        {{ option.label }}
      </view>
    </view>

    <view class="theme-heading accent-heading">
      <view>
        <view class="theme-title">
          配色
        </view>
        <view class="theme-copy">
          强调色。首页沉浸流仍是深绿。
        </view>
      </view>
      <text class="theme-current">
        {{ currentAccentLabel }}
      </text>
    </view>
    <view class="accent-options">
      <view
        v-for="option in accentOptions"
        :key="option.value"
        class="accent-choice pressable"
        :class="{ active: accent === option.value }"
        @tap="selectAccent(option.value)"
      >
        <view
          class="accent-chip"
          :class="`accent-chip-${option.value}`"
        />
        <text class="accent-label">
          {{ option.label }}
        </text>
      </view>
    </view>

    <view class="theme-heading accent-heading">
      <view>
        <view class="theme-title">
          主按钮
        </view>
        <view class="theme-copy">
          保存、装一罐、登录。十二款可与套装混搭。
        </view>
      </view>
      <text class="theme-current">
        {{ currentPrimaryLabel }}
      </text>
    </view>
    <view class="look-options">
      <view
        v-for="option in primaryLooks"
        :key="`primary-${option.value}`"
        class="look-choice pressable"
        :class="{ active: primaryLook === option.value }"
        @tap="selectPrimaryLook(option.value)"
      >
        <view
          class="look-preview"
          :class="`look-preview--${option.value}`"
        >
          罐
        </view>
        <text class="accent-label">
          {{ option.label }}
        </text>
      </view>
    </view>

    <view class="theme-heading accent-heading">
      <view>
        <view class="theme-title">
          次按钮
        </view>
        <view class="theme-copy">
          编辑资料、消息、查看贡献履历。
        </view>
      </view>
      <text class="theme-current">
        {{ currentGhostLabel }}
      </text>
    </view>
    <view class="look-options">
      <view
        v-for="option in ghostLooks"
        :key="`ghost-${option.value}`"
        class="look-choice pressable"
        :class="{ active: ghostLook === option.value }"
        @tap="selectGhostLook(option.value)"
      >
        <view
          class="look-preview look-preview--ghost"
          :class="`look-preview--${option.value}`"
        >
          罐
        </view>
        <text class="accent-label">
          {{ option.label }}
        </text>
      </view>
    </view>

    <view class="theme-heading accent-heading">
      <view>
        <view class="theme-title">
          特效
        </view>
        <view class="theme-copy">
          叠在主按钮和次按钮上。系统若减少动效，呼吸会自动关掉。
        </view>
      </view>
      <text class="theme-current">
        {{ currentEffectLabel }}
      </text>
    </view>
    <view class="effect-options">
      <view
        v-for="option in effectOptions"
        :key="option.value"
        class="theme-option pressable"
        :class="{ active: effect === option.value }"
        @tap="selectEffect(option.value)"
      >
        {{ option.label }}
      </view>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import {
  ACCENT_OPTIONS,
  applyTheme,
  EFFECT_OPTIONS,
  getAccentPreference,
  getEffectPreference,
  getGhostLookPreference,
  getMatchingStylePack,
  getPrimaryLookPreference,
  getThemePreference,
  GHOST_LOOKS,
  PRIMARY_LOOKS,
  setAccentPreference,
  setEffectPreference,
  setGhostLookPreference,
  setPrimaryLookPreference,
  setStylePack,
  setThemePreference,
  STYLE_PACKS,
  THEME_OPTIONS,
} from '@/services/theme';

export default {
  name: 'ThemeSwitcher',
  components: { BaseButton },
  data() {
    return {
      themeOptions: THEME_OPTIONS,
      accentOptions: ACCENT_OPTIONS,
      packOptions: STYLE_PACKS,
      primaryLooks: PRIMARY_LOOKS,
      ghostLooks: GHOST_LOOKS,
      effectOptions: EFFECT_OPTIONS,
      preference: getThemePreference(),
      accent: getAccentPreference(),
      primaryLook: getPrimaryLookPreference(),
      ghostLook: getGhostLookPreference(),
      effect: getEffectPreference(),
      pack: getMatchingStylePack(),
    };
  },
  computed: {
    currentThemeLabel() {
      return this.themeOptions.find((option) => option.value === this.preference)?.label;
    },
    currentAccentLabel() {
      return this.accentOptions.find((option) => option.value === this.accent)?.label;
    },
    currentPrimaryLabel() {
      return this.primaryLooks.find((option) => option.value === this.primaryLook)?.label;
    },
    currentGhostLabel() {
      return this.ghostLooks.find((option) => option.value === this.ghostLook)?.label;
    },
    currentEffectLabel() {
      return this.effectOptions.find((option) => option.value === this.effect)?.label;
    },
  },
  mounted() {
    this.syncAppearance(applyTheme());
  },
  methods: {
    syncAppearance(next) {
      this.preference = next.preference;
      this.accent = next.accent;
      this.primaryLook = next.primaryLook || next.buttonStyle;
      this.ghostLook = next.ghostLook;
      this.effect = next.effect;
      this.pack = next.pack || '';
    },
    selectTheme(preference) {
      this.syncAppearance(setThemePreference(preference));
    },
    selectAccent(accent) {
      this.syncAppearance(setAccentPreference(accent));
    },
    selectPack(pack) {
      this.syncAppearance(setStylePack(pack));
    },
    selectPrimaryLook(look) {
      this.syncAppearance(setPrimaryLookPreference(look));
    },
    selectGhostLook(look) {
      this.syncAppearance(setGhostLookPreference(look));
    },
    selectEffect(effect) {
      this.syncAppearance(setEffectPreference(effect));
    },
  },
};
</script>

<style scoped>
.theme-studio {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.theme-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.accent-heading {
  margin-top: var(--space-4);
}

.theme-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.theme-kicker {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.theme-copy,
.theme-current,
.accent-label {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.theme-copy {
  margin-top: var(--space-1);
  line-height: 1.6;
}

.theme-preview {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.theme-preview-btn {
  flex: 1;
}

.theme-options,
.effect-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.theme-options {
  grid-template-columns: repeat(3, 1fr);
}

.pack-options,
.accent-options,
.look-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.accent-options {
  grid-template-columns: repeat(3, 1fr);
}

.theme-option,
.pack-choice {
  margin: 0;
  padding: 0 var(--space-1);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-xs);
  line-height: 62rpx;
  text-align: center;
}

.theme-option.active,
.pack-choice.active,
.accent-choice.active,
.look-choice.active {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.theme-option.active {
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.accent-choice,
.look-choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.accent-chip,
.look-preview {
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 700;
  line-height: 44rpx;
  text-align: center;
}

.accent-chip {
  box-shadow: 0 0 0 2rpx var(--border-color);
}

.accent-choice.active .accent-chip,
.look-choice.active .look-preview {
  box-shadow: 0 0 0 4rpx var(--accent-color);
}

.look-preview {
  min-width: 56rpx;
  padding: 0 var(--space-1);
  color: var(--on-accent-color);
  background: var(--accent-color);
}

.look-preview--ghost {
  color: var(--accent-color);
  background: var(--surface-color);
  box-shadow: inset 0 0 0 2rpx var(--accent-color);
}

.look-preview--fill {
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.look-preview--outline,
.look-preview--line,
.look-preview--quiet {
  background: var(--surface-color);
  color: var(--accent-color);
  box-shadow: inset 0 0 0 2rpx var(--accent-color);
}

.look-preview--soft,
.look-preview--fresh,
.look-preview--wash,
.look-preview--filled {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.look-preview--contrast,
.look-preview--solemn {
  background: var(--text-color);
  color: var(--page-color);
  border-radius: var(--radius-md);
}

.look-preview--classic,
.look-preview--seal {
  border-radius: var(--radius-sm);
  letter-spacing: 0.12em;
  box-shadow: inset 0 0 0 2rpx var(--on-accent-color), 0 0 0 3rpx var(--accent-color);
}

.look-preview--ardent {
  box-shadow: 0 6rpx 16rpx var(--accent-subtle-color);
}

.look-preview--gilt {
  background: var(--surface-color);
  color: var(--gilt-color);
  box-shadow: inset 0 0 0 2rpx var(--gilt-color);
}

.look-preview--fog {
  opacity: 0.72;
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.accent-chip-pine {
  background: var(--accent-preview-pine);
}

.accent-chip-tea {
  background: var(--accent-preview-tea);
}

.accent-chip-ink {
  background: var(--accent-preview-ink);
}

.accent-chip-clay {
  background: var(--accent-preview-clay);
}

.accent-chip-mist {
  background: var(--accent-preview-mist);
}

.accent-chip-osmanthus {
  background: var(--accent-preview-osmanthus);
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
