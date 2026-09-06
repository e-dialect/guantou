const unboundResult = () => ({ ok: false, reason: 'unbound' });

const defaultAdapters = Object.freeze({
  accessLabel: (access) => String(access || ''),
  applyRemoteEntitlement: unboundResult,
  catalogStatus: (item) => (item?.available ? 'available' : 'upcoming'),
  clearThemeStyleCache: () => {},
  defaultCatalog: () => ({ themes: [], dresses: [] }),
  getActiveThemeId: () => 'default',
  getDefaultThemeId: () => 'default',
  getDialectRegions: () => [],
  getDressCategories: () => [],
  getDressGroup: () => null,
  getMemberStatus: () => false,
  getThemeAccessFilters: () => [],
  getThemeCategories: () => [],
  getThemeSorts: () => [],
  hydrateFavoriteMap: unboundResult,
  hydrateFromCloudConfig: unboundResult,
  hydrateSavedOutfits: unboundResult,
  mergeGuestThemeSnapshot: unboundResult,
  mergeRemoteCatalog: unboundResult,
  persistActiveTheme: async () => unboundResult(),
  persistLocalDress: async () => unboundResult(),
  postThemeEvent: async () => null,
  pullThemeCloudState: async () => unboundResult(),
  setOverlayLocalDress: () => false,
});

const adapters = { ...defaultAdapters };

export function bindThemeRuntimeAdapters(next = {}) {
  const previous = {};
  Object.entries(next).forEach(([name, adapter]) => {
    if (!Object.prototype.hasOwnProperty.call(defaultAdapters, name)) {
      throw new Error(`Unknown theme runtime adapter: ${name}`);
    }
    if (typeof adapter !== 'function') {
      throw new TypeError(`Theme runtime adapter ${name} must be a function`);
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

export function themeRuntime() {
  return adapters;
}
