import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  getThemePreference,
  setThemePreference,
  THEME_STORAGE_KEY,
} from '@/services/theme';

describe('theme preference', () => {
  beforeEach(() => {
    globalThis.uni = {
      $emit: vi.fn(),
      getStorageSync: vi.fn(),
      getSystemInfoSync: vi.fn(() => ({ theme: 'light' })),
      setStorageSync: vi.fn(),
    };
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    vi.clearAllMocks();
  });

  it('falls back to the system theme for an invalid stored value', () => {
    uni.getStorageSync.mockReturnValue('sepia');
    uni.getSystemInfoSync.mockReturnValue({ theme: 'light' });

    expect(getThemePreference()).toBe('system');
    expect(applyTheme()).toEqual({ preference: 'system', resolved: 'light' });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists and broadcasts a selected dark theme', () => {
    const result = setThemePreference('dark');

    expect(result).toEqual({ preference: 'dark', resolved: 'dark' });
    expect(uni.setStorageSync).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    expect(uni.$emit).toHaveBeenCalledWith('theme-change', result);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
