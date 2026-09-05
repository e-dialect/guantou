import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/utils/httpClient', () => ({
  request: (...args) => request(...args),
}));

vi.mock('@/services/authGuard', () => ({
  isLoggedIn: () => true,
}));

vi.mock('@/services/platform', () => ({
  isWechatMiniProgram: () => false,
}));

import {
  applyThemeRemote,
  claimThemeRemote,
  collectThemeRemote,
  createMixRemote,
  fetchThemeCatalog,
  flushThemeConfig,
  pullThemeCloudState,
} from '@/services/themeApi';
import {
  resetThemeFaultAdapters,
  setThemeCloudFlusher,
} from '@/services/themeFault';
import { THEME_API_PATHS } from '@/services/themeSchema';

describe('themeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeFaultAdapters();
    global.uni = {
      getStorageSync: vi.fn((key) => (key === 'token' ? 'token' : '')),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
    };
  });

  it('maps catalog pages onto theme and decoration items', async () => {
    request.mockImplementation((method, url) => {
      if (url === THEME_API_PATHS.themes) {
        return Promise.resolve({
          catalog_version: 3,
          next: null,
          results: [{
            theme_id: 'default',
            name: '默认方言主题',
            privilege_type: 'free',
            status: 'available',
            cover_img: 'default',
          }],
        });
      }
      if (url === THEME_API_PATHS.decorations) {
        return Promise.resolve({
          catalog_version: 3,
          next: null,
          results: [{
            decoration_id: 'cards-plain',
            name: '系统默认录音卡',
            component_type: 'card',
            group: 'cards',
            privilege_type: 'free',
            status: 'available',
          }],
        });
      }
      return Promise.resolve({});
    });
    const catalog = await fetchThemeCatalog();
    expect(catalog.catalog_version).toBe(3);
    expect(catalog.themes[0]).toMatchObject({
      id: 'default',
      access: 'free',
      available: true,
    });
    expect(catalog.dresses[0]).toMatchObject({
      id: 'cards-plain',
      group: 'cards',
    });
  });

  it('follows catalog next links until the storefront has the full list', async () => {
    request.mockImplementation((method, url, params) => {
      if (url === THEME_API_PATHS.themes) {
        if (params.page === 1) {
          return Promise.resolve({
            catalog_version: 5,
            next: 'http://localhost:8000/themes/?page=2&page_size=100',
            results: [{
              theme_id: 'default',
              name: '默认方言主题',
              privilege_type: 'free',
              status: 'available',
            }],
          });
        }
        return Promise.resolve({
          catalog_version: 5,
          next: null,
          results: [{
            theme_id: 'inkline',
            name: '青墨细栏',
            privilege_type: 'free',
            status: 'available',
          }],
        });
      }
      if (url === THEME_API_PATHS.decorations) {
        return Promise.resolve({
          catalog_version: 5,
          next: null,
          results: [{
            decoration_id: 'cards-plain',
            name: '系统默认录音卡',
            component_type: 'card',
            group: 'cards',
            privilege_type: 'free',
            status: 'available',
          }],
        });
      }
      return Promise.resolve({});
    });
    const catalog = await fetchThemeCatalog();
    expect(catalog.themes.map((item) => item.id)).toEqual(['default', 'inkline']);
    expect(request).toHaveBeenCalledWith(
      'GET',
      THEME_API_PATHS.themes,
      { page: 1, page_size: 100 },
      expect.objectContaining({ silent: true, auth: false }),
    );
    expect(request).toHaveBeenCalledWith(
      'GET',
      THEME_API_PATHS.themes,
      { page: 2, page_size: 100 },
      expect.objectContaining({ silent: true, auth: false }),
    );
  });

  it('keeps decoration results when the theme list request fails', async () => {
    request.mockImplementation((method, url) => {
      if (url === THEME_API_PATHS.themes) {
        return Promise.reject(new Error('timeout'));
      }
      if (url === THEME_API_PATHS.decorations) {
        return Promise.resolve({
          catalog_version: 4,
          results: [{
            decoration_id: 'cards-plain',
            name: '系统默认录音卡',
            component_type: 'card',
            group: 'cards',
            privilege_type: 'free',
            status: 'available',
          }],
        });
      }
      return Promise.resolve({});
    });
    const catalog = await fetchThemeCatalog();
    expect(catalog.themes).toEqual([]);
    expect(catalog.dresses[0].id).toBe('cards-plain');
    expect(catalog.catalog_version).toBe(4);
  });

  it('puts current config ids and ignores a failed social sync', async () => {
    request.mockImplementation((method, url) => {
      if (method === 'PUT' && url === THEME_API_PATHS.config) {
        return Promise.resolve({ global_theme_id: 'default' });
      }
      if (url === THEME_API_PATHS.collects || url === THEME_API_PATHS.mixes) {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve({});
    });
    const result = await flushThemeConfig({
      themeId: 'default',
      overlay: true,
      localDress: { cards: 'cards-plain' },
      favorites: { themes: ['default'], dresses: [] },
      outfits: [],
    });
    expect(result.ok).toBe(true);
    expect(result.syncFailed).toBe(true);
    expect(request).toHaveBeenCalledWith(
      'PUT',
      THEME_API_PATHS.config,
      expect.objectContaining({
        global_theme_id: 'default',
        is_cover_local_decoration: true,
        platform: 'h5',
      }),
      expect.objectContaining({ silent: true, timeout: 15000 }),
    );
  });

  it('does not overwrite local pending changes when their flush fails', async () => {
    const store = {
      token: 'token',
      ui_theme_pack_cloud: { themeId: 'paper' },
    };
    uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
    setThemeCloudFlusher(() => Promise.reject(new Error('offline')));
    const result = await pullThemeCloudState();
    expect(result).toEqual({ ok: false, reason: 'sync-pending' });
    expect(request).not.toHaveBeenCalledWith(
      'GET',
      THEME_API_PATHS.config,
      expect.anything(),
      expect.anything(),
    );
  });

  it('retries a locally renamed saved mix during cloud flush', async () => {
    request.mockImplementation((method, url) => {
      if (method === 'PUT' && url === THEME_API_PATHS.config) return Promise.resolve({});
      if (method === 'GET' && url === THEME_API_PATHS.mixes) {
        return Promise.resolve([{ mix_id: 'outfit-1', mix_name: '旧名称' }]);
      }
      return Promise.resolve({});
    });
    await flushThemeConfig({
      themeId: 'default',
      outfits: [{
        id: 'outfit-1',
        name: '新名称',
        themeId: 'default',
        localDress: {},
      }],
    });
    expect(request).toHaveBeenCalledWith(
      'PATCH',
      `${THEME_API_PATHS.mixes}outfit-1/`,
      { mix_name: '新名称' },
      expect.objectContaining({ silent: true }),
    );
  });

  it('hydrates the local outfit from cloud config', async () => {
    const hydrateFromCloudConfig = vi.fn();
    vi.doMock('@/services/themeCenter', () => ({
      hydrateFromCloudConfig,
    }));
    request.mockResolvedValue({
      global_theme_id: 'default',
      decoration_map: {},
      is_cover_local_decoration: true,
    });
    const result = await pullThemeCloudState();
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith(
      'GET',
      THEME_API_PATHS.config,
      {},
      expect.objectContaining({ silent: true }),
    );
  });

  it('posts apply with the current terminal', async () => {
    request.mockResolvedValue({ global_theme_id: 'paper' });
    await applyThemeRemote('theme', 'paper');
    expect(request).toHaveBeenCalledWith(
      'POST',
      THEME_API_PATHS.apply,
      expect.objectContaining({
        item_type: 'theme',
        item_id: 'paper',
        platform: 'h5',
      }),
      expect.objectContaining({ silent: true }),
    );
  });

  it('posts entitlement claims without a platform field', async () => {
    request.mockResolvedValue({ activity_ids: ['event-lantern'] });
    await claimThemeRemote('theme', 'event-lantern');
    expect(request).toHaveBeenCalledWith(
      'POST',
      THEME_API_PATHS.entitlement,
      expect.objectContaining({
        item_type: 'theme',
        item_id: 'event-lantern',
      }),
      expect.objectContaining({ silent: true }),
    );
  });

  it('posts collect with item type and id', async () => {
    request.mockResolvedValue({ item_id: 'default', item_type: 'theme' });
    await collectThemeRemote('theme', 'default');
    expect(request).toHaveBeenCalledWith(
      'POST',
      THEME_API_PATHS.collects,
      expect.objectContaining({
        item_type: 'theme',
        item_id: 'default',
      }),
      expect.objectContaining({ silent: true }),
    );
  });

  it('posts a saved mix snapshot', async () => {
    request.mockResolvedValue({ mix_id: 'outfit-1' });
    await createMixRemote({
      mix_id: 'outfit-1',
      mix_name: '巷口搭配',
      global_theme_id: 'default',
      is_cover_local_decoration: false,
    });
    expect(request).toHaveBeenCalledWith(
      'POST',
      THEME_API_PATHS.mixes,
      expect.objectContaining({
        mix_id: 'outfit-1',
        is_cover_local_decoration: false,
      }),
      expect.objectContaining({ silent: true }),
    );
  });
});
