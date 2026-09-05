import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  LOCAL_DRESS_STORAGE_KEY,
  THEME_FAVORITE_STORAGE_KEY,
  getFavoriteMap,
  getLocalDressMap,
  resetThemeSessionState,
  writeStorage,
} from '@/services/theme/store';

describe('theme store domain', () => {
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

  it('owns storage keys and returns defensive state copies', () => {
    expect(writeStorage(LOCAL_DRESS_STORAGE_KEY, { cards: 'cards-plain' }).ok).toBe(true);
    expect(writeStorage(THEME_FAVORITE_STORAGE_KEY, {
      themes: ['paper'],
      dresses: [],
    }).ok).toBe(true);

    const localDress = getLocalDressMap();
    const favorites = getFavoriteMap();
    localDress.cards = 'mutated';
    favorites.themes.push('mutated');

    expect(getLocalDressMap()).toEqual({ cards: 'cards-plain' });
    expect(getFavoriteMap()).toEqual({ themes: ['paper'], dresses: [] });
  });
});
