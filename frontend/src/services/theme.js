export const THEME_STORAGE_KEY = 'ui_theme';

export const THEME_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const THEME_VALUES = new Set(THEME_OPTIONS.map((option) => option.value));

export function getThemePreference() {
  const saved = uni.getStorageSync(THEME_STORAGE_KEY);
  return THEME_VALUES.has(saved) ? saved : 'system';
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

export function applyTheme(preference = getThemePreference()) {
  const safePreference = THEME_VALUES.has(preference) ? preference : 'system';
  const resolved = resolveTheme(safePreference);

  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }
  // #endif

  uni.$emit('theme-change', { preference: safePreference, resolved });
  return { preference: safePreference, resolved };
}

export function setThemePreference(preference) {
  const safePreference = THEME_VALUES.has(preference) ? preference : 'system';
  uni.setStorageSync(THEME_STORAGE_KEY, safePreference);
  return applyTheme(safePreference);
}
