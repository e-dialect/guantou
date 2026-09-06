import { isH5Runtime } from '@/services/platform';

export const THEME_STORAGE_KEY = 'ui_theme';
export const ACCENT_STORAGE_KEY = 'ui_accent';
export const BUTTON_STYLE_STORAGE_KEY = 'ui_button_style';
export const GHOST_LOOK_STORAGE_KEY = 'ui_button_ghost';
export const EFFECT_STORAGE_KEY = 'ui_button_effect';

export const THEME_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export const ACCENT_OPTIONS = [
  { value: 'pine', label: '松绿' },
  { value: 'tea', label: '茶褐' },
  { value: 'ink', label: '青墨' },
  { value: 'clay', label: '陶土' },
  { value: 'mist', label: '雾青' },
  { value: 'osmanthus', label: '桂金' },
];

export const PRIMARY_LOOKS = [
  { value: 'fill', label: '实心' },
  { value: 'outline', label: '描边' },
  { value: 'soft', label: '浅底' },
  { value: 'contrast', label: '墨色' },
  { value: 'classic', label: '古风' },
  { value: 'ardent', label: '热烈' },
  { value: 'solemn', label: '深沉' },
  { value: 'fresh', label: '清新' },
  { value: 'seal', label: '朱印' },
  { value: 'gilt', label: '金线' },
  { value: 'wash', label: '水墨' },
  { value: 'fog', label: '雾面' },
];

export const GHOST_LOOKS = [
  { value: 'line', label: '细线' },
  { value: 'soft', label: '浅底' },
  { value: 'classic', label: '古风框' },
  { value: 'ardent', label: '暖边' },
  { value: 'solemn', label: '沉线' },
  { value: 'fresh', label: '清透' },
  { value: 'seal', label: '印框' },
  { value: 'gilt', label: '金框' },
  { value: 'wash', label: '淡墨' },
  { value: 'fog', label: '薄雾' },
  { value: 'quiet', label: '素净' },
  { value: 'filled', label: '浅填' },
];

export const EFFECT_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'glow', label: '光晕' },
  { value: 'lift', label: '微浮' },
  { value: 'gilt', label: '金边' },
  { value: 'ink', label: '晕墨' },
  { value: 'pulse', label: '呼吸' },
  { value: 'press', label: '按压' },
  { value: 'bloom', label: '散光' },
];

export const STYLE_PACKS = [
  {
    value: 'pine',
    label: '松绿',
    accent: 'pine',
    primaryLook: 'fill',
    ghostLook: 'line',
    effect: 'none',
  },
  {
    value: 'classic',
    label: '古风',
    accent: 'osmanthus',
    primaryLook: 'classic',
    ghostLook: 'classic',
    effect: 'gilt',
  },
  {
    value: 'ardent',
    label: '热烈',
    accent: 'clay',
    primaryLook: 'ardent',
    ghostLook: 'ardent',
    effect: 'glow',
  },
  {
    value: 'solemn',
    label: '深沉',
    accent: 'ink',
    primaryLook: 'solemn',
    ghostLook: 'solemn',
    effect: 'none',
  },
  {
    value: 'fresh',
    label: '清新',
    accent: 'mist',
    primaryLook: 'fresh',
    ghostLook: 'fresh',
    effect: 'none',
  },
  {
    value: 'porcelain',
    label: '青花',
    accent: 'ink',
    primaryLook: 'outline',
    ghostLook: 'wash',
    effect: 'none',
  },
  {
    value: 'cinnabar',
    label: '朱砂',
    accent: 'clay',
    primaryLook: 'seal',
    ghostLook: 'seal',
    effect: 'glow',
  },
  {
    value: 'bamboo',
    label: '竹影',
    accent: 'pine',
    primaryLook: 'wash',
    ghostLook: 'line',
    effect: 'none',
  },
  {
    value: 'dusk',
    label: '暮霞',
    accent: 'osmanthus',
    primaryLook: 'ardent',
    ghostLook: 'soft',
    effect: 'bloom',
  },
  {
    value: 'frost',
    label: '霜白',
    accent: 'mist',
    primaryLook: 'soft',
    ghostLook: 'fog',
    effect: 'none',
  },
  {
    value: 'salt',
    label: '海盐',
    accent: 'mist',
    primaryLook: 'fill',
    ghostLook: 'fresh',
    effect: 'lift',
  },
  {
    value: 'inkgold',
    label: '墨金',
    accent: 'osmanthus',
    primaryLook: 'contrast',
    ghostLook: 'gilt',
    effect: 'gilt',
  },
];

/** @deprecated use PRIMARY_LOOKS */
export const BUTTON_STYLE_OPTIONS = PRIMARY_LOOKS;

const THEME_VALUES = new Set(THEME_OPTIONS.map((option) => option.value));
const ACCENT_VALUES = new Set(ACCENT_OPTIONS.map((option) => option.value));
const PRIMARY_LOOK_VALUES = new Set(PRIMARY_LOOKS.map((option) => option.value));
const GHOST_LOOK_VALUES = new Set(GHOST_LOOKS.map((option) => option.value));
const EFFECT_VALUES = new Set(EFFECT_OPTIONS.map((option) => option.value));

export const OUTLINE_PRIMARY_LOOKS = new Set(['outline', 'classic', 'gilt', 'fog', 'wash']);
export const RECT_PRIMARY_LOOKS = new Set(['contrast', 'classic', 'seal', 'solemn']);
export const FILL_GHOST_LOOKS = new Set(['soft', 'filled']);

function readStorage(key) {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return '';
  }
  return uni.getStorageSync(key);
}

function writeStorage(key, value) {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return;
  uni.setStorageSync(key, value);
}

export function getThemePreference() {
  const saved = readStorage(THEME_STORAGE_KEY);
  return THEME_VALUES.has(saved) ? saved : 'system';
}

export function getAccentPreference() {
  const saved = readStorage(ACCENT_STORAGE_KEY);
  return ACCENT_VALUES.has(saved) ? saved : 'pine';
}

export function getPrimaryLookPreference() {
  const saved = readStorage(BUTTON_STYLE_STORAGE_KEY);
  return PRIMARY_LOOK_VALUES.has(saved) ? saved : 'fill';
}

export function getButtonStylePreference() {
  return getPrimaryLookPreference();
}

export function getGhostLookPreference() {
  const saved = readStorage(GHOST_LOOK_STORAGE_KEY);
  return GHOST_LOOK_VALUES.has(saved) ? saved : 'line';
}

export function getEffectPreference() {
  const saved = readStorage(EFFECT_STORAGE_KEY);
  return EFFECT_VALUES.has(saved) ? saved : 'none';
}

export function writeAppearancePreference(appearance = {}) {
  if (appearance.accent && ACCENT_VALUES.has(appearance.accent)) {
    writeStorage(ACCENT_STORAGE_KEY, appearance.accent);
  }
  if (appearance.primaryLook && PRIMARY_LOOK_VALUES.has(appearance.primaryLook)) {
    writeStorage(BUTTON_STYLE_STORAGE_KEY, appearance.primaryLook);
  }
  if (appearance.ghostLook && GHOST_LOOK_VALUES.has(appearance.ghostLook)) {
    writeStorage(GHOST_LOOK_STORAGE_KEY, appearance.ghostLook);
  }
  if (appearance.effect && EFFECT_VALUES.has(appearance.effect)) {
    writeStorage(EFFECT_STORAGE_KEY, appearance.effect);
  }
}

export function getMatchingStylePack() {
  const accent = getAccentPreference();
  const primaryLook = getPrimaryLookPreference();
  const ghostLook = getGhostLookPreference();
  const effect = getEffectPreference();
  return STYLE_PACKS.find((pack) => (
    pack.accent === accent
    && pack.primaryLook === primaryLook
    && pack.ghostLook === ghostLook
    && pack.effect === effect
  ))?.value || '';
}

export function resolveTheme(preference = getThemePreference()) {
  if (preference !== 'system') return preference;

  // #ifdef H5
  if (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  // #endif

  try {
    return uni.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export const ACCENT_CHROME = {
  pine: {
    page: '#f6f7f3',
    pageDark: '#121915',
    nav: '#1f5c43',
    immersive: '#0a1410',
  },
  tea: {
    page: '#f7f3ee',
    pageDark: '#191410',
    nav: '#8b5a2b',
    immersive: '#140f0c',
  },
  ink: {
    page: '#f3f5f8',
    pageDark: '#12161c',
    nav: '#2c4a6e',
    immersive: '#0c1016',
  },
  clay: {
    page: '#f8f2ed',
    pageDark: '#1a1411',
    nav: '#b85c38',
    immersive: '#140e0c',
  },
  mist: {
    page: '#f3f6f6',
    pageDark: '#121918',
    nav: '#4a6b6c',
    immersive: '#0c1414',
  },
  osmanthus: {
    page: '#f8f5ea',
    pageDark: '#18160f',
    nav: '#b8860b',
    immersive: '#14120a',
  },
};

export function getAccentChrome(accent = getAccentPreference()) {
  return ACCENT_CHROME[accent] || ACCENT_CHROME.pine;
}

function callUni(name, payload) {
  if (typeof uni === 'undefined' || typeof uni[name] !== 'function') return;
  try {
    const result = uni[name](payload);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // This optional chrome API is allowed to be unavailable at runtime.
      });
    }
  } catch {
    // Some runtimes polyfill these as no-ops.
  }
}

export function paintNativeChrome({
  resolved = 'light',
  accent = 'pine',
  immersive = false,
} = {}) {
  if (isH5Runtime()) return;
  const chrome = getAccentChrome(accent);
  let backgroundColor = chrome.page;
  if (immersive) backgroundColor = chrome.immersive;
  else if (resolved === 'dark') backgroundColor = chrome.pageDark;
  const frontColor = immersive || resolved === 'dark' ? '#ffffff' : '#000000';
  callUni('setNavigationBarColor', {
    frontColor,
    backgroundColor: immersive ? chrome.immersive : chrome.nav,
    animation: { duration: 0 },
  });
  callUni('setBackgroundColor', {
    backgroundColor,
    backgroundColorTop: backgroundColor,
    backgroundColorBottom: backgroundColor,
  });
}

function writeDocumentTheme(resolved, appearance) {
  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.accent = appearance.accent;
    document.documentElement.dataset.buttonStyle = appearance.primaryLook;
    document.documentElement.dataset.primaryLook = appearance.primaryLook;
    document.documentElement.dataset.ghostLook = appearance.ghostLook;
    document.documentElement.dataset.effect = appearance.effect;
    document.documentElement.style.colorScheme = resolved;
  }
  // #endif
  paintNativeChrome({
    resolved,
    accent: appearance.accent,
    immersive: false,
  });
}

function emitTheme(next) {
  if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
    uni.$emit('theme-change', next);
  }
  return next;
}

export function applyTheme(
  preference = getThemePreference(),
  accent = getAccentPreference(),
  primaryLook = getPrimaryLookPreference(),
  ghostLook = getGhostLookPreference(),
  effect = getEffectPreference(),
) {
  const safePreference = THEME_VALUES.has(preference) ? preference : 'system';
  const safeAccent = ACCENT_VALUES.has(accent) ? accent : 'pine';
  const safePrimary = PRIMARY_LOOK_VALUES.has(primaryLook) ? primaryLook : 'fill';
  const safeGhost = GHOST_LOOK_VALUES.has(ghostLook) ? ghostLook : 'line';
  const safeEffect = EFFECT_VALUES.has(effect) ? effect : 'none';
  const resolved = resolveTheme(safePreference);
  const next = {
    preference: safePreference,
    resolved,
    accent: safeAccent,
    buttonStyle: safePrimary,
    primaryLook: safePrimary,
    ghostLook: safeGhost,
    effect: safeEffect,
    pack: STYLE_PACKS.find((pack) => (
      pack.accent === safeAccent
      && pack.primaryLook === safePrimary
      && pack.ghostLook === safeGhost
      && pack.effect === safeEffect
    ))?.value || '',
  };
  writeDocumentTheme(resolved, next);
  return emitTheme(next);
}

export function setThemePreference(preference) {
  const safePreference = THEME_VALUES.has(preference) ? preference : 'system';
  writeStorage(THEME_STORAGE_KEY, safePreference);
  return applyTheme(safePreference);
}

export function setAccentPreference(accent) {
  const safeAccent = ACCENT_VALUES.has(accent) ? accent : 'pine';
  writeStorage(ACCENT_STORAGE_KEY, safeAccent);
  return applyTheme(getThemePreference(), safeAccent);
}

export function setPrimaryLookPreference(primaryLook) {
  const safePrimary = PRIMARY_LOOK_VALUES.has(primaryLook) ? primaryLook : 'fill';
  writeStorage(BUTTON_STYLE_STORAGE_KEY, safePrimary);
  return applyTheme(
    getThemePreference(),
    getAccentPreference(),
    safePrimary,
    getGhostLookPreference(),
    getEffectPreference(),
  );
}

export function setButtonStylePreference(buttonStyle) {
  return setPrimaryLookPreference(buttonStyle);
}

export function setGhostLookPreference(ghostLook) {
  const safeGhost = GHOST_LOOK_VALUES.has(ghostLook) ? ghostLook : 'line';
  writeStorage(GHOST_LOOK_STORAGE_KEY, safeGhost);
  return applyTheme(
    getThemePreference(),
    getAccentPreference(),
    getPrimaryLookPreference(),
    safeGhost,
    getEffectPreference(),
  );
}

export function setEffectPreference(effect) {
  const safeEffect = EFFECT_VALUES.has(effect) ? effect : 'none';
  writeStorage(EFFECT_STORAGE_KEY, safeEffect);
  return applyTheme(
    getThemePreference(),
    getAccentPreference(),
    getPrimaryLookPreference(),
    getGhostLookPreference(),
    safeEffect,
  );
}

export function setStylePack(packValue) {
  const pack = STYLE_PACKS.find((item) => item.value === packValue) || STYLE_PACKS[0];
  writeStorage(ACCENT_STORAGE_KEY, pack.accent);
  writeStorage(BUTTON_STYLE_STORAGE_KEY, pack.primaryLook);
  writeStorage(GHOST_LOOK_STORAGE_KEY, pack.ghostLook);
  writeStorage(EFFECT_STORAGE_KEY, pack.effect);
  return applyTheme(
    getThemePreference(),
    pack.accent,
    pack.primaryLook,
    pack.ghostLook,
    pack.effect,
  );
}
