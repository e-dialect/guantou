/**
 * Backward-compatible theme facade. Domain ownership lives under services/theme/.
 */
import {
  DIALECT_REGIONS,
  DRESS_CATEGORIES,
  GLOBAL_THEMES,
  LOCAL_DRESS_ITEMS,
  THEME_ACCESS_FILTERS,
  THEME_CATEGORIES,
  THEME_SORTS,
  accessLabel,
  catalogStatus,
  getActiveThemeId,
  getDressGroup,
  mergeRemoteCatalog,
} from '@/services/theme/catalog';
import { DEFAULT_THEME_ID } from '@/services/theme/contracts';
import '@/services/theme/render';
import { getMemberStatus } from '@/services/theme/store';
import {
  applyRemoteEntitlement,
  hydrateFavoriteMap,
  hydrateFromCloudConfig,
  hydrateSavedOutfits,
  mergeGuestThemeSnapshot,
  persistActiveTheme,
  persistLocalDress,
  setOverlayLocalDress,
} from '@/services/theme/sync';
import { bindThemeRuntimeAdapters } from '@/services/themeRuntime';

export * from '@/services/theme/catalog';
export * from '@/services/theme/contracts';
export * from '@/services/theme/render';
export * from '@/services/theme/sync';
export {
  THEME_PACK_STORAGE_KEY,
  THEME_OVERLAY_STORAGE_KEY,
  LOCAL_DRESS_STORAGE_KEY,
  THEME_CLOUD_QUEUE_KEY,
  THEME_MEMBER_STORAGE_KEY,
  THEME_OWNED_STORAGE_KEY,
  THEME_CREATOR_STORAGE_KEY,
  THEME_CREATOR_UNLOCKED_KEY,
  THEME_SHARDS_STORAGE_KEY,
  THEME_RECENT_STORAGE_KEY,
  THEME_OUTFIT_STORAGE_KEY,
  THEME_QUERY_STORAGE_KEY,
  THEME_SEARCH_CACHE_KEY,
  THEME_RECENT_LIMIT,
  THEME_OUTFIT_LIMIT,
  THEME_OUTFIT_NAME_MAX,
  THEME_SEARCH_KEYWORD_MAX,
  THEME_FAVORITE_STORAGE_KEY,
  THEME_LIKE_STORAGE_KEY,
  getMemberStatus,
  getOwnedMap,
  isOwned,
  getFavoriteMap,
  getLikeMap,
  isFavorited,
  isLiked,
  getCreatorProgress,
  creatorUnlocked,
  getShards,
  getOverlayLocalDress,
  getLocalDressMap,
  getRecentRaw,
  getSavedOutfits,
  resetThemeSessionState,
} from '@/services/theme/store';

bindThemeRuntimeAdapters({
  accessLabel,
  applyRemoteEntitlement,
  catalogStatus,
  defaultCatalog: () => ({
    themes: GLOBAL_THEMES,
    dresses: LOCAL_DRESS_ITEMS,
  }),
  getActiveThemeId,
  getDefaultThemeId: () => DEFAULT_THEME_ID,
  getDialectRegions: () => DIALECT_REGIONS,
  getDressCategories: () => DRESS_CATEGORIES,
  getDressGroup,
  getMemberStatus,
  getThemeAccessFilters: () => THEME_ACCESS_FILTERS,
  getThemeCategories: () => THEME_CATEGORIES,
  getThemeSorts: () => THEME_SORTS,
  hydrateFavoriteMap,
  hydrateFromCloudConfig,
  hydrateSavedOutfits,
  mergeGuestThemeSnapshot,
  mergeRemoteCatalog,
  persistActiveTheme,
  persistLocalDress,
  setOverlayLocalDress,
});
