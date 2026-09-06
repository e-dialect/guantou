import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  applySavedOutfit,
  getThemeById,
  persistActiveTheme,
  resetThemeSessionState,
  THEME_PACK_STORAGE_KEY,
} from '@/services/themeCenter';
import {
  applyThemeMergeChoice,
  beginThemeApply,
  bindThemeNetworkFlush,
  flushThemeCloudQueue,
  guestThemeSnapshot,
  handleThemeAccountLogin,
  isQuotaError,
  loadThemeCatalog,
  parseThemeStyle,
  refreshThemeMemberStatus,
  resetThemeFaultAdapters,
  setThemeCatalogFetcher,
  setThemeCloudFlusher,
  setThemeMemberFetcher,
  THEME_CATALOG_CACHE_KEY,
  THEME_CATALOG_VERSION_KEY,
  THEME_FAULT_KIND,
  THEME_FAULT_TOAST,
  THEME_GUEST_SNAP_KEY,
  themeResourceHealth,
  writeThemeStorage,
} from '@/services/themeFault';
import { bindThemeRuntimeAdapters } from '@/services/themeRuntime';

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

describe('themeFault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeFaultAdapters();
    resetThemeSessionState();
    const store = {};
    global.uni = {
      getStorageSync: vi.fn((key) => store[key] ?? ''),
      setStorageSync: vi.fn((key, value) => {
        store[key] = value;
      }),
      removeStorageSync: vi.fn((key) => {
        delete store[key];
      }),
      getSystemInfoSync: vi.fn(() => ({ SDKVersion: '2.10.0' })),
    };
  });

  it('classifies quota errors and style JSON failures', () => {
    expect(isQuotaError(new Error('quota exceeded'))).toBe(true);
    expect(parseThemeStyle('{bad').ok).toBe(false);
    expect(parseThemeStyle('{bad').kind).toBe(THEME_FAULT_KIND.DATA);
    expect(themeResourceHealth({ preview: '' }).reason).toBe('resource');
    expect(themeResourceHealth({ preview: 'home', removed: true }).reason).toBe('removed');
  });

  it('falls back to cached catalog ids after a network failure', async () => {
    writeThemeStorage(THEME_CATALOG_CACHE_KEY, {
      themes: ['default'],
      dresses: [],
    });
    setThemeCatalogFetcher(() => Promise.reject(new Error('network')));
    const stale = await loadThemeCatalog();
    expect(stale).toMatchObject({
      ok: false,
      source: 'cache',
      stale: true,
      kind: THEME_FAULT_KIND.NETWORK,
    });
    expect(stale.data.themes.length).toBeGreaterThan(0);
  });

  it('returns an empty catalog source when there is no cache', async () => {
    setThemeCatalogFetcher(() => Promise.reject(new Error('network')));
    const empty = await loadThemeCatalog();
    expect(empty).toMatchObject({
      ok: false,
      source: 'empty',
      stale: false,
      data: null,
    });
  });

  it('drops catalog caches when catalog_version changes', async () => {
    writeThemeStorage(THEME_CATALOG_VERSION_KEY, 1);
    writeThemeStorage('theme_cache', [{ id: 'stale', style_json: { accent: 'old' } }]);
    setThemeCatalogFetcher(async () => ({
      catalog_version: 2,
      themes: [{ id: 'default', name: '默认方言主题', style_json: { accent: 'pine' } }],
      dresses: [],
    }));
    const result = await loadThemeCatalog();
    expect(result.ok).toBe(true);
    expect(uni.getStorageSync(THEME_CATALOG_VERSION_KEY)).toBe(2);
    expect(uni.getStorageSync('theme_cache')[0]).toMatchObject({ id: 'default' });
    expect(uni.getStorageSync('theme_cache')[0].style_json).toBeUndefined();
  });

  it('debounces apply clicks within 800ms', () => {
    expect(beginThemeApply('theme:default').ok).toBe(true);
    expect(beginThemeApply('theme:default')).toMatchObject({
      ok: false,
      reason: 'busy',
      kind: THEME_FAULT_KIND.USER,
    });
    expect(beginThemeApply('outfit:mix').ok).toBe(true);
  });

  it('keeps the session theme when storage quota is full', async () => {
    uni.setStorageSync.mockImplementation((key) => {
      if (key === THEME_PACK_STORAGE_KEY) {
        throw new Error('quota exceeded');
      }
    });
    const result = persistActiveTheme('default');
    await expect(result).resolves.toMatchObject({
      ok: true,
      persisted: false,
      reason: 'quota',
    });
  });

  it('evicts ephemeral caches then retries a core theme write', () => {
    const store = {
      ui_theme_catalog_cache: { themes: ['stale'] },
      ui_theme_query: { q: 'pine' },
    };
    let packWrites = 0;
    uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
    uni.setStorageSync.mockImplementation((key, value) => {
      if (key === THEME_PACK_STORAGE_KEY) {
        packWrites += 1;
        if (packWrites === 1) throw new Error('quota exceeded');
      }
      store[key] = value;
    });
    uni.removeStorageSync.mockImplementation((key) => {
      delete store[key];
    });
    const result = writeThemeStorage(THEME_PACK_STORAGE_KEY, 'default');
    expect(result).toMatchObject({ ok: true, purged: true });
    expect(store[THEME_PACK_STORAGE_KEY]).toBe('default');
    expect(store.ui_theme_catalog_cache).toBeUndefined();
    expect(store.ui_theme_query).toBeUndefined();
  });

  it('asks to merge guest snapshots after login', async () => {
    uni.setStorageSync('ui_theme_guest_snap', {
      themeId: 'member-pine',
      localDress: { cards: 'cards-plain' },
      outfits: [],
    });
    const login = await handleThemeAccountLogin('user-1');
    expect(login.merge.themeId).toBe('member-pine');
    expect(guestThemeSnapshot().themeId).toBe('member-pine');
  });

  it('treats guest-only favorites as mergeable state', () => {
    uni.setStorageSync(THEME_GUEST_SNAP_KEY, {
      themeId: 'default',
      localDress: {},
      outfits: [],
      favorites: { themes: ['paper'], dresses: [] },
    });
    expect(guestThemeSnapshot()?.favorites.themes).toEqual(['paper']);
  });

  it('keeps the guest snapshot when cloud selection cannot load', async () => {
    const snapshot = {
      themeId: 'paper',
      localDress: {},
      favorites: { themes: ['paper'], dresses: [] },
    };
    uni.setStorageSync('token', 'token');
    uni.setStorageSync(THEME_GUEST_SNAP_KEY, snapshot);
    const restore = bindThemeRuntimeAdapters({
      pullThemeCloudState: vi.fn().mockRejectedValueOnce(new Error('offline')),
    });
    try {
      const result = await applyThemeMergeChoice('cloud', snapshot);
      expect(result).toMatchObject({ ok: false, choice: 'cloud', kind: THEME_FAULT_KIND.NETWORK });
      expect(uni.getStorageSync(THEME_GUEST_SNAP_KEY)).toEqual(snapshot);
    } finally {
      restore();
    }
  });

  it('clears local theme keys when switching accounts', async () => {
    uni.setStorageSync('ui_theme_account', 'user-a');
    uni.setStorageSync(THEME_PACK_STORAGE_KEY, 'member-pine');
    const switched = await handleThemeAccountLogin('user-b');
    expect(switched.switched).toBe(true);
    expect(uni.removeStorageSync).toHaveBeenCalled();
  });

  it('reports a network kind when cloud flush fails', async () => {
    uni.setStorageSync('token', 'token');
    uni.setStorageSync('ui_theme_pack_cloud', { themeId: 'default' });
    setThemeCloudFlusher(() => Promise.reject(new Error('offline')));
    const result = await flushThemeCloudQueue();
    expect(result).toMatchObject({ ok: false, kind: THEME_FAULT_KIND.NETWORK });
  });

  it('clears a synced cloud queue without deleting a newer payload', async () => {
    uni.setStorageSync('token', 'token');
    uni.setStorageSync('ui_theme_pack_cloud', { themeId: 'paper' });
    setThemeCloudFlusher(async () => ({ ok: true }));
    expect(await flushThemeCloudQueue()).toEqual({ ok: true });
    expect(uni.getStorageSync('ui_theme_pack_cloud')).toBe('');

    uni.setStorageSync('ui_theme_pack_cloud', { themeId: 'paper' });
    setThemeCloudFlusher(async () => {
      uni.setStorageSync('ui_theme_pack_cloud', { themeId: 'nightferry' });
      return { ok: true };
    });
    expect(await flushThemeCloudQueue()).toEqual({ ok: true });
    expect(uni.getStorageSync('ui_theme_pack_cloud')).toEqual({ themeId: 'nightferry' });
  });

  it('keeps the cloud queue when social reconciliation needs a retry', async () => {
    uni.setStorageSync('token', 'token');
    uni.setStorageSync('ui_theme_pack_cloud', { themeId: 'paper' });
    setThemeCloudFlusher(async () => ({ ok: true, syncFailed: true }));
    const result = await flushThemeCloudQueue();
    expect(result).toMatchObject({ ok: false, syncFailed: true });
    expect(uni.getStorageSync('ui_theme_pack_cloud')).toEqual({ themeId: 'paper' });
  });

  it('silently refreshes the catalog after reconnect when a fetcher is bound', async () => {
    let onChange;
    uni.onNetworkStatusChange = vi.fn((handler) => {
      onChange = handler;
    });
    setThemeCatalogFetcher(async () => ({
      themes: [{ id: 'default', blurb: 'from-reconnect', available: true }],
      dresses: [],
    }));
    bindThemeNetworkFlush();
    onChange({ isConnected: true });
    await vi.waitFor(() => {
      expect(getThemeById('default')?.blurb).toBe('from-reconnect');
    });
  });

  it('skips missing dress ids when applying a saved mix', () => {
    const applied = applySavedOutfit({
      themeId: 'gone-theme',
      localDress: { cards: 'gone-id' },
    });
    expect(applied.skipped).toBe(true);
    expect(applied.empty).toBe(true);
    expect(applied.themeId).toBe('default');
    expect(THEME_FAULT_TOAST.skippedRemoved).toBe('部分装扮已下架，已自动跳过');
    expect(THEME_FAULT_TOAST.mixEmpty).toBe('当前搭配无有效装扮，已恢复默认样式');
    expect(THEME_FAULT_TOAST.mixDuplicate).toBe('该搭配方案已保存，请勿重复添加');
    expect(THEME_FAULT_TOAST.memberExpired).toBe('会员已到期，会员装扮暂不可用');
    expect(THEME_FAULT_TOAST.rate).toBe('操作过于频繁，请稍后再试');
  });

  it('toasts when cloud membership expires without deleting the stored theme id', async () => {
    uni.setStorageSync('token', 'token');
    uni.setStorageSync('ui_theme_member', '1');
    uni.setStorageSync(THEME_PACK_STORAGE_KEY, 'member-pine');
    setThemeMemberFetcher(async () => false);
    const { notify } = await import('@/services/feedback');
    const result = await refreshThemeMemberStatus();
    expect(result.member).toBe(false);
    expect(notify).toHaveBeenCalledWith({ title: THEME_FAULT_TOAST.memberExpired });
    expect(uni.getStorageSync(THEME_PACK_STORAGE_KEY)).toBe('member-pine');
  });
});
