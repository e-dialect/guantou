import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import {
  ACCENT_STORAGE_KEY,
  applyTheme,
  BUTTON_STYLE_STORAGE_KEY,
  EFFECT_STORAGE_KEY,
  GHOST_LOOK_STORAGE_KEY,
  getAccentPreference,
  getButtonStylePreference,
  getEffectPreference,
  getGhostLookPreference,
  getMatchingStylePack,
  GHOST_LOOKS,
  paintNativeChrome,
  PRIMARY_LOOKS,
  setAccentPreference,
  setButtonStylePreference,
  setEffectPreference,
  setGhostLookPreference,
  setStylePack,
  setThemePreference,
  STYLE_PACKS,
  THEME_STORAGE_KEY,
  writeAppearancePreference,
} from '@/services/theme';

function appearance(overrides = {}) {
  return {
    preference: 'system',
    resolved: 'light',
    accent: 'pine',
    buttonStyle: 'fill',
    primaryLook: 'fill',
    ghostLook: 'line',
    effect: 'none',
    pack: 'pine',
    ...overrides,
  };
}

describe('theme preference', () => {
  beforeEach(() => {
    global.uni = {
      $emit: vi.fn(),
      getStorageSync: vi.fn(),
      getSystemInfoSync: vi.fn(() => ({ theme: 'light', uniPlatform: 'mp-weixin' })),
      setStorageSync: vi.fn(),
    };
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-button-style');
    document.documentElement.removeAttribute('data-primary-look');
    document.documentElement.removeAttribute('data-ghost-look');
    document.documentElement.removeAttribute('data-effect');
    document.documentElement.style.colorScheme = '';
    vi.clearAllMocks();
  });

  it('offers twelve primary looks, twelve ghost looks and twelve packs', () => {
    expect(PRIMARY_LOOKS).toHaveLength(12);
    expect(GHOST_LOOKS).toHaveLength(12);
    expect(STYLE_PACKS).toHaveLength(12);
    expect(PRIMARY_LOOKS.map((item) => item.label)).toEqual(expect.arrayContaining([
      '古风',
      '热烈',
      '深沉',
      '清新',
    ]));
  });

  it('falls back to the system theme for an invalid stored value', () => {
    uni.getStorageSync.mockReturnValue('sepia');
    uni.getSystemInfoSync.mockReturnValue({ theme: 'light' });

    expect(applyTheme()).toEqual(appearance());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.accent).toBe('pine');
    expect(document.documentElement.dataset.buttonStyle).toBe('fill');
    expect(document.documentElement.dataset.primaryLook).toBe('fill');
    expect(document.documentElement.dataset.ghostLook).toBe('line');
    expect(document.documentElement.dataset.effect).toBe('none');
  });

  it('persists and broadcasts a selected dark theme', () => {
    uni.getStorageSync.mockImplementation((key) => (key === ACCENT_STORAGE_KEY ? 'pine' : ''));
    const result = setThemePreference('dark');

    expect(result).toEqual(appearance({
      preference: 'dark',
      resolved: 'dark',
    }));
    expect(uni.setStorageSync).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    expect(uni.$emit).toHaveBeenCalledWith('theme-change', result);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('falls back to pine for an invalid stored accent', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === ACCENT_STORAGE_KEY) return 'neon';
      return '';
    });
    expect(getAccentPreference()).toBe('pine');
  });

  it('persists a selected accent without changing the appearance mode', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) return 'light';
      if (key === ACCENT_STORAGE_KEY) return 'pine';
      return '';
    });
    const result = setAccentPreference('tea');

    expect(result).toEqual(appearance({
      preference: 'light',
      resolved: 'light',
      accent: 'tea',
      pack: '',
    }));
    expect(uni.setStorageSync).toHaveBeenCalledWith(ACCENT_STORAGE_KEY, 'tea');
    expect(document.documentElement.dataset.accent).toBe('tea');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('paints native nav and page chrome for the selected accent', () => {
    uni.setNavigationBarColor = vi.fn();
    uni.setBackgroundColor = vi.fn();
    uni.getStorageSync.mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) return 'light';
      if (key === ACCENT_STORAGE_KEY) return 'tea';
      return '';
    });
    setAccentPreference('tea');
    expect(uni.setNavigationBarColor).toHaveBeenCalledWith(expect.objectContaining({
      frontColor: '#000000',
      backgroundColor: '#8b5a2b',
    }));
    expect(uni.setBackgroundColor).toHaveBeenCalledWith(expect.objectContaining({
      backgroundColor: '#f7f3ee',
      backgroundColorTop: '#f7f3ee',
    }));

    paintNativeChrome({ accent: 'ink', immersive: true });
    expect(uni.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({
      frontColor: '#ffffff',
      backgroundColor: '#0c1016',
    }));
    expect(uni.setBackgroundColor).toHaveBeenLastCalledWith(expect.objectContaining({
      backgroundColor: '#0c1016',
    }));
  });

  it('keeps H5 theme changes in the document without calling native chrome APIs', () => {
    uni.getSystemInfoSync.mockReturnValue({ theme: 'light', uniPlatform: 'web' });
    uni.setNavigationBarColor = vi.fn();
    uni.setBackgroundColor = vi.fn();

    const result = setAccentPreference('tea');

    expect(result.accent).toBe('tea');
    expect(document.documentElement.dataset.accent).toBe('tea');
    expect(uni.setNavigationBarColor).not.toHaveBeenCalled();
    expect(uni.setBackgroundColor).not.toHaveBeenCalled();
  });

  it('attaches rejection handlers to optional native chrome calls', () => {
    const navigationCatch = vi.fn();
    const backgroundCatch = vi.fn();
    uni.setNavigationBarColor = vi.fn(() => ({ catch: navigationCatch }));
    uni.setBackgroundColor = vi.fn(() => ({ catch: backgroundCatch }));

    paintNativeChrome({ accent: 'pine' });

    expect(navigationCatch).toHaveBeenCalledOnce();
    expect(backgroundCatch).toHaveBeenCalledOnce();
  });

  it('persists a selected button style without changing the palette', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) return 'light';
      if (key === ACCENT_STORAGE_KEY) return 'tea';
      if (key === BUTTON_STYLE_STORAGE_KEY) return 'fill';
      return '';
    });
    const result = setButtonStylePreference('soft');

    expect(result).toEqual(appearance({
      preference: 'light',
      resolved: 'light',
      accent: 'tea',
      buttonStyle: 'soft',
      primaryLook: 'soft',
      pack: '',
    }));
    expect(uni.setStorageSync).toHaveBeenCalledWith(BUTTON_STYLE_STORAGE_KEY, 'soft');
    expect(document.documentElement.dataset.buttonStyle).toBe('soft');
    expect(document.documentElement.dataset.primaryLook).toBe('soft');
    expect(document.documentElement.dataset.accent).toBe('tea');
  });

  it('falls back to fill for an invalid stored button style', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === BUTTON_STYLE_STORAGE_KEY) return 'neon';
      return '';
    });
    expect(getButtonStylePreference()).toBe('fill');
    expect(getGhostLookPreference()).toBe('line');
    expect(getEffectPreference()).toBe('none');
  });

  it('applies a named style pack across accent, looks and effect', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) return 'light';
      return '';
    });
    const result = setStylePack('classic');

    expect(result).toEqual(appearance({
      preference: 'light',
      resolved: 'light',
      accent: 'osmanthus',
      buttonStyle: 'classic',
      primaryLook: 'classic',
      ghostLook: 'classic',
      effect: 'gilt',
      pack: 'classic',
    }));
    expect(uni.setStorageSync).toHaveBeenCalledWith(ACCENT_STORAGE_KEY, 'osmanthus');
    expect(uni.setStorageSync).toHaveBeenCalledWith(BUTTON_STYLE_STORAGE_KEY, 'classic');
    expect(uni.setStorageSync).toHaveBeenCalledWith(GHOST_LOOK_STORAGE_KEY, 'classic');
    expect(uni.setStorageSync).toHaveBeenCalledWith(EFFECT_STORAGE_KEY, 'gilt');
    expect(document.documentElement.dataset.effect).toBe('gilt');
  });

  it('lets users mix looks and only highlights a pack when they still match', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === THEME_STORAGE_KEY) return 'light';
      if (key === ACCENT_STORAGE_KEY) return 'osmanthus';
      if (key === BUTTON_STYLE_STORAGE_KEY) return 'classic';
      if (key === GHOST_LOOK_STORAGE_KEY) return 'classic';
      if (key === EFFECT_STORAGE_KEY) return 'gilt';
      return '';
    });
    expect(getMatchingStylePack()).toBe('classic');

    const result = setGhostLookPreference('line');
    expect(result.pack).toBe('');
    expect(result.ghostLook).toBe('line');
    expect(uni.setStorageSync).toHaveBeenCalledWith(GHOST_LOOK_STORAGE_KEY, 'line');

    const glow = setEffectPreference('glow');
    expect(glow.effect).toBe('glow');
    expect(document.documentElement.dataset.effect).toBe('glow');
  });

  it('writes appearance tokens so later pages keep the enabled pack', () => {
    writeAppearancePreference({
      accent: 'ink',
      primaryLook: 'contrast',
      ghostLook: 'gilt',
      effect: 'glow',
    });
    expect(uni.setStorageSync).toHaveBeenCalledWith(ACCENT_STORAGE_KEY, 'ink');
    expect(uni.setStorageSync).toHaveBeenCalledWith(BUTTON_STYLE_STORAGE_KEY, 'contrast');
    expect(uni.setStorageSync).toHaveBeenCalledWith(GHOST_LOOK_STORAGE_KEY, 'gilt');
    expect(uni.setStorageSync).toHaveBeenCalledWith(EFFECT_STORAGE_KEY, 'glow');
  });
});
