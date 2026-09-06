import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/themeApi', () => ({
  applyThemeRemote: vi.fn(),
  claimThemeRemote: vi.fn(),
  collectThemeRemote: vi.fn(),
  createMixRemote: vi.fn(),
  deleteMixRemote: vi.fn(),
  renameMixRemote: vi.fn(),
  uncollectThemeRemote: vi.fn(),
}));

import { bindThemeCatalogPort } from '@/services/theme/catalogPort';
import {
  THEME_QUERY_STORAGE_KEY,
  THEME_SEARCH_CACHE_KEY,
  resetThemeSessionState,
} from '@/services/theme/store';
import { searchThemeCatalog } from '@/services/theme/sync';

describe('theme sync domain', () => {
  beforeEach(() => {
    const values = {};
    global.uni = {
      getStorageSync: vi.fn((key) => values[key] ?? ''),
      setStorageSync: vi.fn((key, value) => {
        values[key] = value;
      }),
      removeStorageSync: vi.fn((key) => {
        delete values[key];
      }),
    };
    resetThemeSessionState();
  });

  it('persists search state against a fixture catalog port', () => {
    const queryThemeCatalog = vi.fn(() => ({
      themes: [],
      dresses: [],
      all: [{ kind: 'theme', item: { id: 'fixture' } }],
    }));
    const restore = bindThemeCatalogPort({
      cleanSearchKeyword: (value) => String(value || '').trim(),
      defaultThemeQuery: () => ({ keyword: '', searching: false }),
      getThemeQuery: () => ({ keyword: '', searching: false }),
      queryThemeCatalog,
    });
    try {
      const result = searchThemeCatalog('  家乡  ');
      expect(result.all).toHaveLength(1);
      expect(queryThemeCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '家乡', searching: true }),
        { isMiniProgram: false },
      );
      expect(uni.setStorageSync).toHaveBeenCalledWith(
        THEME_QUERY_STORAGE_KEY,
        expect.objectContaining({ keyword: '家乡', searching: true }),
      );
      expect(uni.setStorageSync).toHaveBeenCalledWith(
        THEME_SEARCH_CACHE_KEY,
        expect.objectContaining({ ids: ['theme:fixture'] }),
      );
    } finally {
      restore();
    }
  });
});
