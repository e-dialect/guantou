import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  GLOBAL_THEMES,
  LOCAL_DRESS_ITEMS,
  getDressItem,
  getThemeById,
  queryThemeCatalog,
} from '@/services/theme/catalog';

describe('theme catalog domain', () => {
  beforeEach(() => {
    global.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
    };
  });

  it('owns catalog data and can query it without loading the facade', () => {
    expect(GLOBAL_THEMES.length).toBeGreaterThan(10);
    expect(LOCAL_DRESS_ITEMS.length).toBeGreaterThan(10);
    expect(getThemeById('default')).toBeTruthy();
    expect(getDressItem('cards-plain')).toBeTruthy();

    const result = queryThemeCatalog({ keyword: '纸' });
    expect(result.all.length).toBeGreaterThan(0);
    expect(result.all.every((row) => ['theme', 'dress'].includes(row.kind))).toBe(true);
  });
});
