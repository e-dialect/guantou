/** Theme persistence keys and local session state. */
import { isLoggedIn } from '@/services/authGuard';
import { writeThemeStorage } from '@/services/themeFault';

export const THEME_PACK_STORAGE_KEY = 'ui_theme_pack';

export const THEME_OVERLAY_STORAGE_KEY = 'ui_theme_overlay_local';

export const LOCAL_DRESS_STORAGE_KEY = 'ui_local_dress';

export const THEME_CLOUD_QUEUE_KEY = 'ui_theme_pack_cloud';

export const THEME_MEMBER_STORAGE_KEY = 'ui_theme_member';

export const THEME_OWNED_STORAGE_KEY = 'ui_theme_owned';

export const THEME_CREATOR_STORAGE_KEY = 'ui_theme_creator';

export const THEME_CREATOR_UNLOCKED_KEY = 'ui_theme_creator_unlocked';

export const THEME_SHARDS_STORAGE_KEY = 'ui_theme_shards';

export const THEME_RECENT_STORAGE_KEY = 'ui_theme_recent';

export const THEME_OUTFIT_STORAGE_KEY = 'ui_theme_outfits';

export const THEME_QUERY_STORAGE_KEY = 'ui_theme_query';

export const THEME_SEARCH_CACHE_KEY = 'ui_theme_search_cache';

export const THEME_RECENT_LIMIT = 8;

export const THEME_OUTFIT_LIMIT = 10;

export const THEME_OUTFIT_NAME_MAX = 20;

export const THEME_SEARCH_KEYWORD_MAX = 64;

export const THEME_FAVORITE_STORAGE_KEY = 'ui_theme_favorites';

export const THEME_LIKE_STORAGE_KEY = 'ui_theme_likes';

const sessionState = {
  themeId: null,
  localDress: null,
};

let overlayFlushTimer = 0;

export function readStorage(key) {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return '';
  }
  try {
    return uni.getStorageSync(key);
  } catch {
    return '';
  }
}

export function writeStorage(key, value) {
  const result = writeThemeStorage(key, value);
  if (!result.ok && result.reason === 'quota') {
    if (key === THEME_PACK_STORAGE_KEY) sessionState.themeId = value;
    if (key === LOCAL_DRESS_STORAGE_KEY) sessionState.localDress = value;
  } else if (result.ok) {
    if (key === THEME_PACK_STORAGE_KEY) sessionState.themeId = null;
    if (key === LOCAL_DRESS_STORAGE_KEY) sessionState.localDress = null;
  }
  return result;
}

export function getMemberStatus() {
  const saved = readStorage(THEME_MEMBER_STORAGE_KEY);
  return saved === '1' || saved === true;
}

export function getOwnedMap() {
  const saved = readStorage(THEME_OWNED_STORAGE_KEY);
  const empty = { themes: [], dresses: [] };
  if (!saved) return empty;
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved);
      return {
        themes: [...(parsed.themes || [])],
        dresses: [...(parsed.dresses || [])],
      };
    } catch {
      return empty;
    }
  }
  if (typeof saved === 'object') {
    return {
      themes: [...(saved.themes || [])],
      dresses: [...(saved.dresses || [])],
    };
  }
  return empty;
}

export function isOwned(kind, id) {
  const owned = getOwnedMap();
  const list = kind === 'theme' ? owned.themes : owned.dresses;
  return list.includes(id);
}

export function readPairMap(key) {
  const empty = { themes: [], dresses: [] };
  const saved = readStorage(key);
  if (!saved) return empty;
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved);
      return {
        themes: [...(parsed.themes || [])],
        dresses: [...(parsed.dresses || [])],
      };
    } catch {
      return empty;
    }
  }
  if (typeof saved === 'object') {
    return {
      themes: [...(saved.themes || [])],
      dresses: [...(saved.dresses || [])],
    };
  }
  return empty;
}

export function pairKey(kind) {
  return kind === 'theme' ? 'themes' : 'dresses';
}

export function getFavoriteMap() {
  return readPairMap(THEME_FAVORITE_STORAGE_KEY);
}

export function getLikeMap() {
  return readPairMap(THEME_LIKE_STORAGE_KEY);
}

export function isFavorited(kind, id) {
  return getFavoriteMap()[pairKey(kind)].includes(id);
}

export function isLiked(kind, id) {
  return getLikeMap()[pairKey(kind)].includes(id);
}

export function getCreatorProgress() {
  const saved = readStorage(THEME_CREATOR_STORAGE_KEY);
  const fallback = {
    recordings: 0,
    badge: false,
    challenge: false,
    hometown: false,
  };
  if (!saved || typeof saved !== 'object') return fallback;
  const recordings = Number(saved.recordings ?? saved.cans ?? 0);
  const current = { ...saved };
  delete current.cans;
  return { ...fallback, ...current, recordings };
}

export function creatorUnlocked() {
  if (isLoggedIn()) {
    const cloud = readStorage(THEME_CREATOR_UNLOCKED_KEY);
    if (cloud === '1' || cloud === true) return true;
    if (cloud === '0' || cloud === false) return false;
  }
  const progress = getCreatorProgress();
  return progress.recordings >= 10 && progress.badge && progress.challenge;
}

export function getShards() {
  const saved = readStorage(THEME_SHARDS_STORAGE_KEY);
  const count = Number(saved);
  return Number.isFinite(count) ? count : 0;
}

export function readJsonObject(key, fallback) {
  const saved = readStorage(key);
  if (!saved) return { ...fallback };
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...fallback, ...parsed };
      }
    } catch {
      return { ...fallback };
    }
    return { ...fallback };
  }
  if (typeof saved === 'object' && !Array.isArray(saved)) {
    return { ...fallback, ...saved };
  }
  return { ...fallback };
}

export function getOverlayLocalDress() {
  const saved = readStorage(THEME_OVERLAY_STORAGE_KEY);
  if (saved === '0' || saved === false) return false;
  return true;
}

export function getLocalDressMap() {
  if (sessionState.localDress && typeof sessionState.localDress === 'object') {
    return { ...sessionState.localDress };
  }
  const saved = readStorage(LOCAL_DRESS_STORAGE_KEY);
  if (!saved) return {};
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  if (typeof saved === 'object') return { ...saved };
  return {};
}

export function readJsonList(key) {
  const saved = readStorage(key);
  if (!saved) return [];
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(saved) ? [...saved] : [];
}

export function getRecentRaw() {
  return readJsonList(THEME_RECENT_STORAGE_KEY);
}

export function getSavedOutfits() {
  return readJsonList(THEME_OUTFIT_STORAGE_KEY);
}

export function resetThemeSessionState() {
  sessionState.themeId = null;
  sessionState.localDress = null;
  if (overlayFlushTimer) {
    clearTimeout(overlayFlushTimer);
    overlayFlushTimer = 0;
  }
}

export function getStoredThemeId() {
  return sessionState.themeId ?? readStorage(THEME_PACK_STORAGE_KEY);
}

export function scheduleOverlayFlush(callback) {
  if (overlayFlushTimer) clearTimeout(overlayFlushTimer);
  overlayFlushTimer = setTimeout(() => {
    overlayFlushTimer = 0;
    callback();
  }, 80);
}
