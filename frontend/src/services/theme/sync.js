/** Theme mutations, history and remote synchronization orchestration. */
import { isLoggedIn } from '@/services/authGuard';
import {
  applyThemeRemote,
  claimThemeRemote,
  collectThemeRemote,
  createMixRemote,
  deleteMixRemote,
  renameMixRemote,
  uncollectThemeRemote,
} from '@/services/themeApi';
import {
  canShareOrFavorite,
  cleanSearchKeyword,
  defaultThemeQuery,
  getActiveTheme,
  getActiveThemeId,
  getDressGroup,
  getDressItem,
  getSearchCache,
  getThemeById,
  getThemeQuery,
  hasPermission,
  isDressBlocked,
  listAllDresses,
  listAllThemes,
  queryThemeCatalog,
  recentStatusMeta,
  recentUseStatus,
} from '@/services/theme/catalogPort';
import {
  ACCESS_CREATOR,
  ACCESS_EVENT,
  ACCESS_FREE,
  ACCESS_MEMBER,
  DEFAULT_THEME_ID,
} from '@/services/theme/contracts';
import {
  captureGuestThemeSnapshot,
  scheduleThemeCloudFlush,
  setThemeLogoutHandler,
  themeResourceHealth,
  writeThemeStorage,
} from '@/services/themeFault';
import { hydrateOutfitStyle } from '@/services/theme/renderPort';
import {
  LOCAL_DRESS_STORAGE_KEY,
  THEME_CLOUD_QUEUE_KEY,
  THEME_CREATOR_STORAGE_KEY,
  THEME_CREATOR_UNLOCKED_KEY,
  THEME_FAVORITE_STORAGE_KEY,
  THEME_LIKE_STORAGE_KEY,
  THEME_MEMBER_STORAGE_KEY,
  THEME_OUTFIT_LIMIT,
  THEME_OUTFIT_NAME_MAX,
  THEME_OUTFIT_STORAGE_KEY,
  THEME_OVERLAY_STORAGE_KEY,
  THEME_OWNED_STORAGE_KEY,
  THEME_PACK_STORAGE_KEY,
  THEME_QUERY_STORAGE_KEY,
  THEME_RECENT_LIMIT,
  THEME_RECENT_STORAGE_KEY,
  THEME_SEARCH_CACHE_KEY,
  THEME_SHARDS_STORAGE_KEY,
  creatorUnlocked,
  getCreatorProgress,
  getFavoriteMap,
  getLikeMap,
  getLocalDressMap,
  getMemberStatus,
  getOverlayLocalDress,
  getOwnedMap,
  getRecentRaw,
  getSavedOutfits,
  getShards,
  isFavorited,
  pairKey,
  readPairMap,
  resetThemeSessionState,
  scheduleOverlayFlush,
  writeStorage,
} from '@/services/theme/store';
import {
  clearThemeStyleCache,
  fromCurrentConfig,
  fromSavedMix,
  THEME_DATA_KEYS,
  toCollectList,
  toCurrentConfig,
  toSavedMix,
} from '@/services/themeSchema';

let hydratingCloud = false;

export function recordRecentUse(kind, item) {
  if (!item?.available || item.retired || item.removed) return getRecentRaw();
  if (item.eventStatus === 'ended') return getRecentRaw();
  const group = kind === 'dress' ? item.group : '';
  const next = getRecentRaw().filter((row) => !(row.kind === kind && row.id === item.id));
  next.unshift({
    kind,
    id: item.id,
    group,
    name: item.name,
    preview: item.preview,
    usedAt: Date.now(),
  });
  const trimmed = next.slice(0, THEME_RECENT_LIMIT);
  writeStorage(THEME_RECENT_STORAGE_KEY, trimmed);
  return trimmed;
}

export function listRecentUses({ isMiniProgram = false, kind = 'all' } = {}) {
  return getRecentRaw()
    .filter((row) => (
      row
      && row.id
      && (row.kind === 'theme' || row.kind === 'dress')
      && (kind === 'all' || row.kind === kind)
    ))
    .slice(0, THEME_RECENT_LIMIT)
    .map((row) => {
      const found = row.kind === 'theme' ? getThemeById(row.id) : getDressItem(row.id);
      const item = found || {
        id: row.id,
        name: row.name || '装扮已下架',
        available: false,
        removed: true,
        retired: true,
        preview: row.preview || 'default',
        group: row.group,
      };
      const group = row.kind === 'dress' ? getDressGroup(row.group || item?.group) : null;
      const status = recentUseStatus(row.kind, item, group, isMiniProgram);
      return {
        ...row,
        item,
        group,
        access: item.access,
        region: item.region,
        status,
        ...recentStatusMeta(status, item),
      };
    });
}

export function listOwnedUnused({ isMiniProgram = false } = {}) {
  const applied = getLocalDressMap();
  const themes = listAllThemes().filter((item) => (
    hasPermission('theme', item)
    && item.id !== getActiveThemeId()
    && (item.access || ACCESS_FREE) !== ACCESS_FREE
  ));
  const dresses = listAllDresses().filter((item) => {
    if (!hasPermission('dress', item)) return false;
    if ((item.access || ACCESS_FREE) === ACCESS_FREE) return false;
    return applied[item.group] !== item.id;
  }).map((item) => {
    const group = getDressGroup(item.group);
    const blocked = isDressBlocked(item, group, isMiniProgram);
    return { group, item, blocked };
  });
  return { themes, dresses };
}

export function setActiveThemeId(themeId) {
  const pack = getThemeById(themeId);
  if (!pack?.available) {
    return { ok: false, reason: 'upcoming' };
  }
  const health = themeResourceHealth(pack);
  if (!health.ok) {
    writeStorage(THEME_PACK_STORAGE_KEY, DEFAULT_THEME_ID);
    return {
      ok: false,
      reason: health.reason,
      fallback: DEFAULT_THEME_ID,
    };
  }
  if (!hasPermission('theme', pack)) {
    return { ok: false, reason: pack.access || 'locked' };
  }
  if (pack.eventStatus === 'ended') {
    return { ok: false, reason: 'ended' };
  }
  const written = writeStorage(THEME_PACK_STORAGE_KEY, pack.id);
  const overlay = getOverlayLocalDress();
  const result = {
    ok: true,
    theme: pack,
    overlayCleared: false,
    overlaySuppressed: overlay,
    persisted: written.ok,
  };
  if (!written.ok) result.reason = written.reason;
  return result;
}

function rememberGuestSnapshot() {
  if (isLoggedIn()) return;
  captureGuestThemeSnapshot({
    themeId: getActiveThemeId(),
    overlay: getOverlayLocalDress(),
    localDress: getLocalDressMap(),
    favorites: getFavoriteMap(),
    likes: getLikeMap(),
    recent: getRecentRaw(),
    outfits: getSavedOutfits(),
  });
}

function writeContractSnapshots() {
  writeThemeStorage(THEME_DATA_KEYS.local_current_config, toCurrentConfig({
    themeId: getActiveThemeId(),
    localDress: getLocalDressMap(),
    overlay: getOverlayLocalDress(),
    recent: getRecentRaw(),
  }));
  writeThemeStorage(THEME_DATA_KEYS.local_collect_list, toCollectList(getFavoriteMap()));
  writeThemeStorage(
    THEME_DATA_KEYS.local_saved_mix,
    getSavedOutfits().map((outfit) => toSavedMix(outfit)),
  );
}

setThemeLogoutHandler(() => {
  resetThemeSessionState();
  clearThemeStyleCache();
  hydrateOutfitStyle();
});

export function hydrateFromCloudConfig(dto) {
  if (!dto || typeof dto !== 'object') return { ok: false, reason: 'empty' };
  hydratingCloud = true;
  try {
    const mapped = fromCurrentConfig(dto, (itemId) => getDressItem(itemId)?.group);
    if (!mapped) return { ok: false, reason: 'empty' };
    writeStorage(THEME_PACK_STORAGE_KEY, mapped.themeId || DEFAULT_THEME_ID);
    writeStorage(LOCAL_DRESS_STORAGE_KEY, mapped.localDress || {});
    writeStorage(THEME_OVERLAY_STORAGE_KEY, mapped.overlay ? '1' : '0');
    writeStorage(THEME_RECENT_STORAGE_KEY, mapped.recent || []);
    writeContractSnapshots();
    hydrateOutfitStyle();
    return { ok: true, ...mapped };
  } catch {
    return { ok: false, reason: 'corrupt' };
  } finally {
    hydratingCloud = false;
  }
}

function queueCloudSync({ social = false } = {}) {
  rememberGuestSnapshot();
  writeContractSnapshots();
  hydrateOutfitStyle();
  if (hydratingCloud || !isLoggedIn()) return false;
  writeStorage(THEME_CLOUD_QUEUE_KEY, {
    themeId: getActiveThemeId(),
    overlay: getOverlayLocalDress(),
    localDress: getLocalDressMap(),
    member: getMemberStatus(),
    owned: getOwnedMap(),
    creator: getCreatorProgress(),
    shards: getShards(),
    favorites: getFavoriteMap(),
    likes: getLikeMap(),
    recent: getRecentRaw(),
    outfits: getSavedOutfits(),
    query: getThemeQuery(),
    searchCache: getSearchCache(),
  });
  scheduleThemeCloudFlush({ social });
  return true;
}

export function setMemberStatus(enabled) {
  writeStorage(THEME_MEMBER_STORAGE_KEY, enabled ? '1' : '0');
  queueCloudSync();
  return getMemberStatus();
}

export function applyRemoteEntitlement(dto = {}) {
  if (typeof dto.is_member === 'boolean') {
    writeStorage(THEME_MEMBER_STORAGE_KEY, dto.is_member ? '1' : '0');
  }
  if (typeof dto.creator_unlocked === 'boolean') {
    writeStorage(THEME_CREATOR_UNLOCKED_KEY, dto.creator_unlocked ? '1' : '0');
  }
  if (Array.isArray(dto.activity_ids)) {
    const owned = getOwnedMap();
    dto.activity_ids.forEach((id) => {
      if (getThemeById(id) && !owned.themes.includes(id)) owned.themes.push(id);
      else if (getDressItem(id) && !owned.dresses.includes(id)) owned.dresses.push(id);
    });
    writeStorage(THEME_OWNED_STORAGE_KEY, owned);
  }
  hydrateOutfitStyle();
  return {
    member: getMemberStatus(),
    creator: creatorUnlocked(),
    owned: getOwnedMap(),
  };
}

function isRemoteApplyRejected(error) {
  const reason = error?.data?.reason || '';
  return ['coming', 'deprecated', 'privilege', 'terminal'].includes(reason)
    || error?.statusCode === 403
    || error?.statusCode === 409;
}

function isRemoteRateLimited(error) {
  return error?.data?.reason === 'rate' || error?.statusCode === 429;
}

function remoteApplyFail(error) {
  const reason = error?.data?.reason || '';
  return {
    ok: false,
    reason: reason || (error?.statusCode === 409 ? 'upcoming' : 'privilege'),
    queued: false,
  };
}

export function claimSkin(kind, id) {
  const item = kind === 'theme' ? getThemeById(id) : getDressItem(id);
  if (!item) return { ok: false, reason: 'missing' };
  const access = item.access || ACCESS_FREE;
  if (access === ACCESS_FREE || access === ACCESS_MEMBER) {
    return { ok: false, reason: access };
  }
  if (access === ACCESS_EVENT && item.eventStatus === 'ended') {
    return { ok: false, reason: 'ended' };
  }
  if (access === ACCESS_CREATOR && !creatorUnlocked()) {
    return { ok: false, reason: 'creator' };
  }
  const owned = getOwnedMap();
  const key = kind === 'theme' ? 'themes' : 'dresses';
  const added = !owned[key].includes(id);
  if (added) owned[key].push(id);
  writeStorage(THEME_OWNED_STORAGE_KEY, owned);
  if (!isLoggedIn()) {
    queueCloudSync();
    return { ok: true, owned };
  }
  const itemType = kind === 'theme' ? 'theme' : 'decoration';
  return claimThemeRemote(itemType, id)
    .then(() => {
      queueCloudSync();
      return { ok: true, owned: getOwnedMap() };
    })
    .catch((error) => {
      if (added) {
        const next = getOwnedMap();
        next[key] = next[key].filter((itemId) => itemId !== id);
        writeStorage(THEME_OWNED_STORAGE_KEY, next);
      }
      return remoteApplyFail(error);
    });
}

export function setCreatorProgress(next) {
  writeStorage(THEME_CREATOR_STORAGE_KEY, { ...getCreatorProgress(), ...next });
  queueCloudSync();
  return getCreatorProgress();
}

export function addShards(amount) {
  const next = getShards() + amount;
  writeStorage(THEME_SHARDS_STORAGE_KEY, next);
  queueCloudSync();
  return next;
}

export function persistThemeQuery(query) {
  const next = { ...defaultThemeQuery(), ...query };
  next.keyword = cleanSearchKeyword(next.keyword);
  writeStorage(THEME_QUERY_STORAGE_KEY, next);
  return next;
}

export function searchThemeCatalog(keyword, query = {}, { isMiniProgram = false } = {}) {
  const next = persistThemeQuery({
    ...getThemeQuery(),
    ...query,
    keyword: cleanSearchKeyword(keyword),
    searching: true,
  });
  const result = queryThemeCatalog(next, { isMiniProgram });
  writeStorage(THEME_SEARCH_CACHE_KEY, {
    keyword: next.keyword,
    ids: result.all.map((row) => `${row.kind}:${row.item.id}`),
    at: Date.now(),
  });
  return {
    ...result,
    query: next,
    queued: false,
  };
}

export function cleanOutfitName(name) {
  const text = String(name || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
  return text.slice(0, THEME_OUTFIT_NAME_MAX);
}

function mixSavedAt(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function outfitFingerprint(outfit = {}) {
  const themeId = outfit.themeId || outfit.global_theme_id || DEFAULT_THEME_ID;
  const overlay = outfit.overlay === undefined && outfit.is_cover_local_decoration === undefined
    ? true
    : Boolean(outfit.overlay ?? outfit.is_cover_local_decoration);
  const dress = outfit.localDress || {};
  const pairs = Object.keys(dress)
    .sort()
    .map((groupId) => `${groupId}:${dress[groupId]}`)
    .join('|');
  return `${themeId}#${overlay ? '1' : '0'}#${pairs}`;
}

export function mergeGuestThemeSnapshot(snapshot = {}) {
  const mergePairs = (cloud = {}, guest = {}) => ({
    themes: [...new Set([...(cloud.themes || []), ...(guest.themes || [])])],
    dresses: [...new Set([...(cloud.dresses || []), ...(guest.dresses || [])])],
  });
  const recentByKey = new Map();
  (snapshot.recent || []).forEach((row) => {
    if (row?.kind && row?.id) recentByKey.set(`${row.kind}:${row.id}`, row);
  });
  getRecentRaw().forEach((row) => {
    if (row?.kind && row?.id) recentByKey.set(`${row.kind}:${row.id}`, row);
  });
  const recent = [...recentByKey.values()]
    .sort((left, right) => Number(right.usedAt || 0) - Number(left.usedAt || 0))
    .slice(0, THEME_RECENT_LIMIT);

  const cloudOutfits = getSavedOutfits();
  const outfitIds = new Set(cloudOutfits.map((row) => row.id).filter(Boolean));
  const outfitFingerprints = new Set(cloudOutfits.map((row) => outfitFingerprint(row)));
  const outfits = [...cloudOutfits];
  (snapshot.outfits || []).forEach((row) => {
    const fingerprint = outfitFingerprint(row);
    if ((row?.id && outfitIds.has(row.id)) || outfitFingerprints.has(fingerprint)) return;
    outfits.push(row);
    if (row?.id) outfitIds.add(row.id);
    outfitFingerprints.add(fingerprint);
  });

  const writes = [
    writeStorage(LOCAL_DRESS_STORAGE_KEY, {
      ...(snapshot.localDress || {}),
      ...getLocalDressMap(),
    }),
    writeStorage(
      THEME_FAVORITE_STORAGE_KEY,
      mergePairs(getFavoriteMap(), snapshot.favorites),
    ),
    writeStorage(THEME_LIKE_STORAGE_KEY, mergePairs(getLikeMap(), snapshot.likes)),
    writeStorage(THEME_RECENT_STORAGE_KEY, recent),
    writeStorage(THEME_OUTFIT_STORAGE_KEY, outfits.slice(0, THEME_OUTFIT_LIMIT)),
  ];
  const failed = writes.find((result) => !result.ok);
  if (failed) return { ok: false, reason: failed.reason || 'write' };
  queueCloudSync({ social: true });
  return {
    ok: true,
    localDress: getLocalDressMap(),
    favorites: getFavoriteMap(),
    recent: getRecentRaw(),
    outfits: getSavedOutfits(),
  };
}

function currentOutfitSnapshot() {
  return {
    themeId: getActiveThemeId(),
    localDress: getLocalDressMap(),
    overlay: getOverlayLocalDress(),
  };
}

function remapOutfitDress(localDress = {}) {
  const next = {};
  Object.entries(localDress).forEach(([groupId, itemId]) => {
    const item = getDressItem(itemId);
    next[item?.group || groupId] = itemId;
  });
  return next;
}

export function hydrateSavedOutfits(rows = []) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((row) => fromSavedMix(row))
    .filter(Boolean)
    .map((outfit) => ({
      ...outfit,
      localDress: remapOutfitDress(outfit.localDress),
      overlay: outfit.overlay !== false,
      savedAt: mixSavedAt(outfit.savedAt),
    }))
    .sort((left, right) => right.savedAt - left.savedAt);
  writeStorage(THEME_OUTFIT_STORAGE_KEY, list);
  return list;
}

export function saveCurrentOutfit(name) {
  const trimmed = cleanOutfitName(name);
  if (!trimmed) return { ok: false, reason: 'name' };
  const list = getSavedOutfits();
  if (list.length >= THEME_OUTFIT_LIMIT) return { ok: false, reason: 'limit' };
  const snapshot = currentOutfitSnapshot();
  if (list.some((item) => outfitFingerprint(item) === outfitFingerprint(snapshot))) {
    return { ok: false, reason: 'duplicate' };
  }
  const outfit = {
    id: `outfit-${Date.now()}`,
    name: trimmed,
    themeId: snapshot.themeId,
    localDress: snapshot.localDress,
    overlay: snapshot.overlay,
    savedAt: Date.now(),
  };
  const next = [outfit, ...list];
  const written = writeStorage(THEME_OUTFIT_STORAGE_KEY, next);
  if (!written.ok) {
    return { ok: false, reason: written.reason, persisted: false };
  }
  if (isLoggedIn()) {
    Promise.resolve(createMixRemote(toSavedMix(outfit))).catch(() => {});
  }
  queueCloudSync({ social: true });
  return {
    ok: true,
    outfit,
    outfits: next,
    queued: true,
  };
}

export function renameSavedOutfit(id, name) {
  const trimmed = cleanOutfitName(name);
  if (!trimmed) return { ok: false, reason: 'name' };
  const next = getSavedOutfits().map((item) => (
    item.id === id ? { ...item, name: trimmed } : item
  ));
  writeStorage(THEME_OUTFIT_STORAGE_KEY, next);
  if (isLoggedIn()) {
    Promise.resolve(renameMixRemote(id, trimmed)).catch(() => {});
  }
  queueCloudSync();
  return { ok: true, outfits: next };
}

export function deleteSavedOutfit(id) {
  const next = getSavedOutfits().filter((item) => item.id !== id);
  writeStorage(THEME_OUTFIT_STORAGE_KEY, next);
  if (isLoggedIn()) {
    Promise.resolve(deleteMixRemote(id)).catch(() => {});
  }
  queueCloudSync();
  return { ok: true, outfits: next };
}

export function applySavedOutfit(outfit, {
  isMiniProgram = false,
} = {}) {
  if (!outfit || typeof outfit !== 'object' || Array.isArray(outfit)) {
    return {
      ok: false,
      reason: 'broken',
      skipped: false,
      empty: false,
    };
  }
  const dressMap = outfit.localDress && typeof outfit.localDress === 'object' && !Array.isArray(outfit.localDress)
    ? outfit.localDress
    : {};
  if (!outfit.themeId && !Object.keys(dressMap).length) {
    return {
      ok: false,
      reason: 'broken',
      skipped: false,
      empty: false,
    };
  }
  let skipped = false;
  const theme = getThemeById(outfit.themeId);
  let themeId = outfit.themeId || DEFAULT_THEME_ID;
  if (recentUseStatus('theme', theme, null, isMiniProgram) !== 'ok') {
    themeId = DEFAULT_THEME_ID;
    skipped = true;
  }
  const nextDress = {};
  Object.entries(dressMap).forEach(([groupId, itemId]) => {
    const item = getDressItem(itemId);
    const group = getDressGroup(groupId);
    if (recentUseStatus('dress', item, group, isMiniProgram) === 'ok') {
      nextDress[groupId] = itemId;
    } else {
      skipped = true;
    }
  });
  writeStorage(
    THEME_OVERLAY_STORAGE_KEY,
    (outfit.overlay === undefined ? getOverlayLocalDress() : Boolean(outfit.overlay))
      ? '1'
      : '0',
  );
  writeStorage(THEME_PACK_STORAGE_KEY, themeId);
  writeStorage(LOCAL_DRESS_STORAGE_KEY, nextDress);
  const appliedTheme = getThemeById(themeId);
  if (appliedTheme) recordRecentUse('theme', appliedTheme);
  Object.values(nextDress).forEach((itemId) => {
    const item = getDressItem(itemId);
    if (item) recordRecentUse('dress', item);
  });
  queueCloudSync();
  const mixHadContent = Boolean(outfit.themeId && outfit.themeId !== DEFAULT_THEME_ID)
    || Object.keys(dressMap).length > 0;
  const appliedNothing = themeId === DEFAULT_THEME_ID && Object.keys(nextDress).length === 0;
  return {
    ok: true,
    skipped,
    empty: Boolean(skipped && mixHadContent && appliedNothing),
    themeId,
    localDress: nextDress,
  };
}

function togglePair(key, kind, id) {
  const map = readPairMap(key);
  const listKey = pairKey(kind);
  const exists = map[listKey].includes(id);
  map[listKey] = exists
    ? map[listKey].filter((item) => item !== id)
    : [...map[listKey], id];
  writeStorage(key, map);
  queueCloudSync();
  return !exists;
}

export function hydrateFavoriteMap(collectList = []) {
  const next = { themes: [], dresses: [] };
  (Array.isArray(collectList) ? collectList : []).forEach((row) => {
    const id = String(row?.item_id || '').trim();
    if (!id) return;
    if (row.item_type === 'theme' && !next.themes.includes(id)) next.themes.push(id);
    if (row.item_type === 'decoration' && !next.dresses.includes(id)) next.dresses.push(id);
  });
  writeStorage(THEME_FAVORITE_STORAGE_KEY, next);
  return next;
}

export function toggleFavorite(kind, item) {
  if (!item?.id) return { ok: false, reason: 'missing', favorited: false };
  const already = isFavorited(kind, item.id);
  if (!canShareOrFavorite(item, { favorited: already })) {
    return { ok: false, reason: 'upcoming', favorited: false };
  }
  const favorited = togglePair(THEME_FAVORITE_STORAGE_KEY, kind, item.id);
  if (!isLoggedIn()) {
    queueCloudSync({ social: true });
    return { ok: true, favorited };
  }
  const itemType = kind === 'theme' ? 'theme' : 'decoration';
  const remote = favorited
    ? collectThemeRemote(itemType, item.id)
    : uncollectThemeRemote(itemType, item.id);
  return remote
    .then(() => {
      queueCloudSync({ social: true });
      return { ok: true, favorited };
    })
    .catch((error) => {
      const coming = error?.data?.reason === 'coming';
      const rate = error?.data?.reason === 'rate' || error?.statusCode === 429;
      if (coming || rate) {
        togglePair(THEME_FAVORITE_STORAGE_KEY, kind, item.id);
        return {
          ok: false,
          reason: coming ? 'upcoming' : 'rate',
          favorited: already,
        };
      }
      queueCloudSync({ social: true });
      return { ok: true, favorited, queued: true };
    });
}

export function toggleLike(kind, item) {
  if (!item?.available) return { ok: false, reason: 'upcoming', liked: false };
  const liked = togglePair(THEME_LIKE_STORAGE_KEY, kind, item.id);
  return { ok: true, liked };
}

function retiredFavoriteItem(kind, id) {
  return {
    id,
    name: '装扮已下架',
    available: false,
    removed: true,
    preview: 'default',
    tag: '已下架',
    group: kind === 'dress' ? '' : undefined,
  };
}

export function listFavorites(filter = 'all') {
  const fav = getFavoriteMap();
  const themes = fav.themes.map((id) => {
    const item = getThemeById(id) || retiredFavoriteItem('theme', id);
    return { kind: 'theme', item };
  });
  const dresses = fav.dresses.map((id) => {
    const item = getDressItem(id) || retiredFavoriteItem('dress', id);
    return {
      kind: 'dress',
      item,
      group: getDressGroup(item.group),
    };
  });
  if (filter === 'theme') return themes;
  if (filter === 'dress') return dresses;
  return [...themes, ...dresses];
}

export async function persistActiveTheme(themeId) {
  const previous = getActiveThemeId();
  const result = setActiveThemeId(themeId);
  if (!result.ok) return result;
  if (isLoggedIn()) {
    try {
      await applyThemeRemote('theme', themeId);
    } catch (error) {
      if (isRemoteApplyRejected(error)) {
        writeStorage(THEME_PACK_STORAGE_KEY, previous);
        hydrateOutfitStyle();
        return remoteApplyFail(error);
      }
      if (isRemoteRateLimited(error)) {
        recordRecentUse('theme', result.theme);
        return { ...result, queued: queueCloudSync(), reason: 'rate' };
      }
    }
  }
  recordRecentUse('theme', result.theme);
  return { ...result, queued: queueCloudSync() };
}

export async function persistCurrentOutfit() {
  return { ok: true, queued: queueCloudSync() };
}

export function setOverlayLocalDress(enabled) {
  writeStorage(THEME_OVERLAY_STORAGE_KEY, enabled ? '1' : '0');
  scheduleOverlayFlush(() => {
    queueCloudSync();
  });
  return getOverlayLocalDress();
}

export async function persistLocalDress(groupId, itemId) {
  const group = getDressGroup(groupId);
  const item = getDressItem(itemId);
  if (!group || !item || item.group !== groupId) {
    return { ok: false, reason: 'missing' };
  }
  const health = themeResourceHealth(item);
  if (!health.ok) {
    return { ok: false, reason: health.reason };
  }
  if (!item.available) {
    return { ok: false, reason: 'upcoming' };
  }
  if (!hasPermission('dress', item)) {
    return { ok: false, reason: item.access || 'locked' };
  }
  if (item.eventStatus === 'ended') {
    return { ok: false, reason: 'ended' };
  }
  const previous = getLocalDressMap();
  const next = { ...previous, [groupId]: item.id };
  const written = writeStorage(LOCAL_DRESS_STORAGE_KEY, next);
  if (isLoggedIn()) {
    try {
      await applyThemeRemote('decoration', item.id);
    } catch (error) {
      if (isRemoteApplyRejected(error)) {
        writeStorage(LOCAL_DRESS_STORAGE_KEY, previous);
        hydrateOutfitStyle();
        return remoteApplyFail(error);
      }
      if (isRemoteRateLimited(error)) {
        if (written.ok) recordRecentUse('dress', item);
        return {
          ok: true,
          item,
          group,
          suppressed: getOverlayLocalDress(),
          queued: queueCloudSync(),
          persisted: written.ok,
          reason: 'rate',
        };
      }
    }
  }
  if (written.ok) recordRecentUse('dress', item);
  const result = {
    ok: true,
    item,
    group,
    suppressed: getOverlayLocalDress(),
    queued: queueCloudSync(),
    persisted: written.ok,
  };
  if (!written.ok) result.reason = written.reason;
  return result;
}

export function clearLocalDress(groupId) {
  const previous = getLocalDressMap();
  if (!previous[groupId]) {
    return { ok: true, cleared: false, queued: false };
  }
  const next = { ...previous };
  delete next[groupId];
  const written = writeStorage(LOCAL_DRESS_STORAGE_KEY, next);
  const result = {
    ok: true,
    cleared: true,
    queued: queueCloudSync(),
    persisted: written.ok,
  };
  if (!written.ok) result.reason = written.reason;
  return result;
}

export async function applyRecent(row, { isMiniProgram = false } = {}) {
  const item = row.kind === 'theme' ? getThemeById(row.id) : getDressItem(row.id);
  const group = row.kind === 'dress' ? getDressGroup(row.group || item?.group) : null;
  const status = recentUseStatus(row.kind, item, group, isMiniProgram);
  if (status !== 'ok') {
    return { ok: false, status, ...recentStatusMeta(status, item) };
  }
  if (row.kind === 'theme') return persistActiveTheme(item.id);
  return persistLocalDress(item.group, item.id);
}

export function setLocalDress(groupId, itemId) {
  return persistLocalDress(groupId, itemId);
}

export async function resetAllDress() {
  // Only live config. Keep saved mixes, favorites, recents, and likes.
  writeStorage(THEME_PACK_STORAGE_KEY, DEFAULT_THEME_ID);
  writeStorage(LOCAL_DRESS_STORAGE_KEY, {});
  writeStorage(THEME_OVERLAY_STORAGE_KEY, '1');
  return {
    ok: true,
    theme: getActiveTheme(),
    overlay: true,
    queued: queueCloudSync(),
  };
}
