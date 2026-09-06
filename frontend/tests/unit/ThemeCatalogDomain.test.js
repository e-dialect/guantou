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

  it('ships an explicit readable tab-bar palette for every live theme and fallback dress', () => {
    const required = [
      'tabBackground',
      'tabColor',
      'tabAccent',
      'tabOnAccent',
      'tabEmphasis',
      'tabBorder',
    ];
    GLOBAL_THEMES.filter((item) => item.style_json).forEach((item) => {
      required.forEach((key) => expect(item.style_json[key], `${item.id}.${key}`).toBeTruthy());
    });

    expect(GLOBAL_THEMES.find((item) => item.id === 'nightferry').style_json).toMatchObject({
      tabBackground: 'var(--page-color)',
      tabColor: 'var(--muted-color)',
      tabAccent: 'var(--accent-color)',
      tabOnAccent: 'var(--on-accent-color)',
      tabEmphasis: 'var(--text-color)',
      tabBorder: 'var(--border-color)',
    });
    expect(GLOBAL_THEMES.find((item) => item.id === 'midautumn').style_json).toMatchObject({
      tabBackground: 'var(--accent-subtle-color)',
      tabColor: 'var(--muted-color)',
      tabAccent: 'var(--accent-color)',
      tabOnAccent: 'var(--on-accent-color)',
      tabEmphasis: 'var(--text-color)',
      tabBorder: 'var(--border-color)',
    });

    expect(getDressItem('tabbar-plain').style_json).toMatchObject({
      tabBackground: 'var(--surface-color)',
      tabColor: 'var(--muted-color)',
      tabAccent: 'var(--accent-color)',
      tabOnAccent: 'var(--on-accent-color)',
      tabEmphasis: 'var(--text-color)',
      tabBorder: 'var(--border-color)',
    });
  });
});
