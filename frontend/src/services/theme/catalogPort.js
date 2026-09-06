import { DEFAULT_THEME_ID } from '@/services/theme/contracts';

const emptyQuery = () => ({
  keyword: '',
  access: 'all',
  category: 'all',
  dressCategory: 'all',
  regions: [],
  status: 'all',
  sort: 'newest',
  resultTab: 'all',
  searching: false,
});

const defaults = Object.freeze({
  canShareOrFavorite: () => false,
  cleanSearchKeyword: (value) => String(value || '').trim(),
  defaultThemeQuery: emptyQuery,
  getActiveTheme: () => null,
  getActiveThemeId: () => DEFAULT_THEME_ID,
  getDressGroup: () => null,
  getDressItem: () => null,
  getSearchCache: () => ({ keyword: '', ids: [], at: 0 }),
  getThemeById: () => null,
  getThemeQuery: emptyQuery,
  hasPermission: () => false,
  isDressBlocked: () => false,
  listAllDresses: () => [],
  listAllThemes: () => [],
  queryThemeCatalog: () => ({ themes: [], dresses: [], all: [] }),
  recentStatusMeta: () => ({ label: '', hint: '', disabled: true }),
  recentUseStatus: () => 'retired',
});

const adapters = { ...defaults };

export function bindThemeCatalogPort(next = {}) {
  const previous = {};
  Object.entries(next).forEach(([name, adapter]) => {
    if (!Object.prototype.hasOwnProperty.call(defaults, name)) {
      throw new Error(`Unknown theme catalog adapter: ${name}`);
    }
    if (typeof adapter !== 'function') {
      throw new TypeError(`Theme catalog adapter ${name} must be a function`);
    }
    previous[name] = adapters[name];
    adapters[name] = adapter;
  });
  return () => {
    Object.entries(previous).forEach(([name, adapter]) => {
      adapters[name] = adapter;
    });
  };
}

export const canShareOrFavorite = (...args) => adapters.canShareOrFavorite(...args);
export const cleanSearchKeyword = (...args) => adapters.cleanSearchKeyword(...args);
export const defaultThemeQuery = (...args) => adapters.defaultThemeQuery(...args);
export const getActiveTheme = (...args) => adapters.getActiveTheme(...args);
export const getActiveThemeId = (...args) => adapters.getActiveThemeId(...args);
export const getDressGroup = (...args) => adapters.getDressGroup(...args);
export const getDressItem = (...args) => adapters.getDressItem(...args);
export const getSearchCache = (...args) => adapters.getSearchCache(...args);
export const getThemeById = (...args) => adapters.getThemeById(...args);
export const getThemeQuery = (...args) => adapters.getThemeQuery(...args);
export const hasPermission = (...args) => adapters.hasPermission(...args);
export const isDressBlocked = (...args) => adapters.isDressBlocked(...args);
export const listAllDresses = () => adapters.listAllDresses();
export const listAllThemes = () => adapters.listAllThemes();
export const queryThemeCatalog = (...args) => adapters.queryThemeCatalog(...args);
export const recentStatusMeta = (...args) => adapters.recentStatusMeta(...args);
export const recentUseStatus = (...args) => adapters.recentUseStatus(...args);
