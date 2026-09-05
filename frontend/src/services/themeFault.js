import { isLoggedIn } from '@/services/authGuard';
import { notify } from '@/services/feedback';
import { isWechatMiniProgram } from '@/services/platform';
import { trackThemeFault } from '@/services/themeAnalytics';
import { themeRuntime } from '@/services/themeRuntime';

export const THEME_CATALOG_CACHE_KEY = 'ui_theme_catalog_cache';
export const THEME_CATALOG_VERSION_KEY = 'ui_theme_catalog_version';
export const THEME_ACCOUNT_KEY = 'ui_theme_account';
export const THEME_GUEST_SNAP_KEY = 'ui_theme_guest_snap';
export const THEME_MIN_MP_SDK = '2.10.0';

export const THEME_FAULT_KIND = {
  USER: 'user',
  NETWORK: 'network',
  DATA: 'data',
  ENV: 'env',
};

export const THEME_FAULT_TOAST = {
  catalogFail: '装扮列表加载失败，请检查网络后重试',
  catalogCache: '当前展示为缓存数据，部分内容可能不是最新',
  syncFail: '装扮已本地生效，云端同步失败，稍后会自动重试',
  socialSyncFail: '操作已本地保存，同步云端失败，网络恢复后自动同步',
  skippedRemoved: '部分装扮已下架，已自动跳过',
  mixDuplicate: '该搭配方案已保存，请勿重复添加',
  mixEmpty: '当前搭配无有效装扮，已恢复默认样式',
  mixBroken: '搭配方案异常，暂无法应用',
  resource: '装扮资源加载异常',
  style: '装扮样式加载异常，已恢复默认',
  memberSync: '会员状态正在同步，请稍候',
  memberExpired: '会员已到期，会员装扮暂不可用',
  quota: '存储空间不足，无法保存装扮配置，请清理存储空间',
  sdk: '当前小程序版本过低，请更新小程序后使用装扮功能',
  album: '保存海报失败，请授予相册权限',
  rate: '操作过于频繁，请稍后再试',
};

export const THEME_STORAGE_KEYS = [
  'ui_theme_pack',
  'ui_theme_overlay_local',
  'ui_local_dress',
  'ui_theme_pack_cloud',
  'ui_theme_member',
  'ui_theme_owned',
  'ui_theme_creator',
  'ui_theme_creator_unlocked',
  'ui_theme_shards',
  'ui_theme_recent',
  'ui_theme_outfits',
  'ui_theme_query',
  'ui_theme_search_cache',
  'ui_theme_favorites',
  'ui_theme_likes',
  'theme_cache',
  'decoration_cache',
  'local_current_config',
  'local_collect_list',
  'local_saved_mix',
];

export const THEME_EPHEMERAL_STORAGE_KEYS = [
  THEME_CATALOG_CACHE_KEY,
  THEME_CATALOG_VERSION_KEY,
  'theme_cache',
  'decoration_cache',
  'ui_theme_query',
  'ui_theme_search_cache',
  'ui_theme_analytics_queue',
];

const APPLY_GAP_MS = 800;
let lastApplyAt = 0;
let lastApplyKey = '';
let previewEpoch = 0;
let catalogFetcher = null;
let cloudFlusher = null;
let memberFetcher = null;
let flushTimer = 0;
let memberSyncing = false;
let networkBound = false;
let onThemeLocalCleared = null;

export function isQuotaError(error) {
  const message = String(error?.errMsg || error?.message || error || '');
  return /quota|limit|full|空间不足/i.test(message);
}

function purgeEphemeralThemeStorage() {
  if (typeof uni === 'undefined' || typeof uni.removeStorageSync !== 'function') return;
  THEME_EPHEMERAL_STORAGE_KEYS.forEach((key) => {
    try {
      uni.removeStorageSync(key);
    } catch {
      // ignore
    }
  });
}

export function writeThemeStorage(key, value) {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') {
    return { ok: false, reason: 'missing' };
  }
  try {
    uni.setStorageSync(key, value);
    return { ok: true };
  } catch (error) {
    const quota = isQuotaError(error);
    if (quota && !THEME_EPHEMERAL_STORAGE_KEYS.includes(key)) {
      purgeEphemeralThemeStorage();
      try {
        uni.setStorageSync(key, value);
        return { ok: true, purged: true };
      } catch (retryError) {
        return {
          ok: false,
          reason: isQuotaError(retryError) ? 'quota' : 'write',
          kind: isQuotaError(retryError) ? THEME_FAULT_KIND.USER : THEME_FAULT_KIND.DATA,
        };
      }
    }
    return {
      ok: false,
      reason: quota ? 'quota' : 'write',
      kind: quota ? THEME_FAULT_KIND.USER : THEME_FAULT_KIND.DATA,
    };
  }
}

export function setThemeLogoutHandler(handler) {
  onThemeLocalCleared = typeof handler === 'function' ? handler : null;
}

export function readThemeStorage(key) {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return '';
  }
  try {
    return uni.getStorageSync(key);
  } catch {
    return '';
  }
}

export function setThemeCatalogFetcher(fetcher) {
  catalogFetcher = fetcher;
}

export function setThemeCloudFlusher(flusher) {
  cloudFlusher = flusher;
}

export function setThemeMemberFetcher(fetcher) {
  memberFetcher = fetcher;
}

export function resetThemeFaultAdapters() {
  catalogFetcher = null;
  cloudFlusher = null;
  memberFetcher = null;
  lastApplyAt = 0;
  lastApplyKey = '';
  previewEpoch = 0;
  memberSyncing = false;
  networkBound = false;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = 0;
}

export function parseThemeStyle(style) {
  if (style == null || style === '') return { ok: true, style: null };
  try {
    const parsed = typeof style === 'string' ? JSON.parse(style) : style;
    if (parsed && typeof parsed !== 'object') {
      return { ok: false, reason: 'style', kind: THEME_FAULT_KIND.DATA };
    }
    return { ok: true, style: parsed };
  } catch {
    return { ok: false, reason: 'style', kind: THEME_FAULT_KIND.DATA };
  }
}

export function themeResourceHealth(item) {
  if (!item) {
    return { ok: false, reason: 'removed', kind: THEME_FAULT_KIND.DATA };
  }
  if (item.removed || item.retired) {
    return { ok: false, reason: 'removed', kind: THEME_FAULT_KIND.DATA };
  }
  if (!item.preview) {
    return { ok: false, reason: 'resource', kind: THEME_FAULT_KIND.DATA };
  }
  const style = parseThemeStyle(item.style);
  if (!style.ok) return style;
  return { ok: true };
}

export function beginThemeApply(key = 'apply') {
  const now = Date.now();
  if (key === lastApplyKey && now - lastApplyAt < APPLY_GAP_MS) {
    return { ok: false, reason: 'busy', kind: THEME_FAULT_KIND.USER };
  }
  lastApplyKey = key;
  lastApplyAt = now;
  return { ok: true };
}

export function beginThemePreview() {
  previewEpoch += 1;
  return previewEpoch;
}

export function abortThemePreview() {
  previewEpoch += 1;
  return previewEpoch;
}

export function isThemePreviewActive(epoch) {
  return epoch === previewEpoch;
}

function compareVersion(left, right) {
  const a = String(left || '0').split('.').map((part) => Number(part) || 0);
  const b = String(right || '0').split('.').map((part) => Number(part) || 0);
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

export function isThemeSdkSupported() {
  if (!isWechatMiniProgram()) return true;
  let sdk = '99.0.0';
  try {
    sdk = uni.getSystemInfoSync?.()?.SDKVersion || sdk;
  } catch {
    sdk = '0.0.0';
  }
  return compareVersion(sdk, THEME_MIN_MP_SDK) >= 0;
}

async function defaultCatalog() {
  return themeRuntime().defaultCatalog();
}

function catalogMetaList(items) {
  return (items || []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy = { ...item };
    delete copy.style_json;
    return copy;
  });
}

function rememberCatalogVersion(version) {
  const next = Number(version) || 0;
  if (!next) return;
  const previous = Number(readThemeStorage(THEME_CATALOG_VERSION_KEY) || 0);
  if (previous && next !== previous) {
    ['theme_cache', 'decoration_cache', THEME_CATALOG_CACHE_KEY].forEach((key) => {
      try {
        uni.removeStorageSync(key);
      } catch {
        // ignore
      }
    });
    try {
      themeRuntime().clearThemeStyleCache();
    } catch {
      // A stale style cache must not block catalog refresh.
    }
  }
  writeThemeStorage(THEME_CATALOG_VERSION_KEY, next);
}

export async function loadThemeCatalog() {
  const fetcher = catalogFetcher || defaultCatalog;
  try {
    const data = await fetcher();
    rememberCatalogVersion(data.catalog_version);
    writeThemeStorage(THEME_CATALOG_CACHE_KEY, {
      at: Date.now(),
      version: Number(data.catalog_version) || 0,
      themes: (data.themes || []).map((item) => item.id),
      dresses: (data.dresses || []).map((item) => item.id),
    });
    writeThemeStorage('theme_cache', catalogMetaList(data.themes || []));
    writeThemeStorage('decoration_cache', catalogMetaList(data.dresses || []));
    return {
      ok: true,
      source: 'remote',
      stale: false,
      kind: null,
      data,
    };
  } catch {
    const cached = readThemeStorage(THEME_CATALOG_CACHE_KEY)
      || readThemeStorage('theme_cache');
    if (cached && typeof cached === 'object' && (cached.themes || cached.dresses)) {
      const fallback = await defaultCatalog();
      return {
        ok: false,
        source: 'cache',
        stale: true,
        kind: THEME_FAULT_KIND.NETWORK,
        data: fallback,
      };
    }
    return {
      ok: false,
      source: 'empty',
      stale: false,
      kind: THEME_FAULT_KIND.NETWORK,
      data: null,
    };
  }
}

export function isThemeMemberSyncing() {
  return memberSyncing;
}

export async function refreshThemeMemberStatus() {
  if (!isLoggedIn()) {
    memberSyncing = false;
    return { syncing: false, member: false };
  }
  memberSyncing = true;
  try {
    const { applyRemoteEntitlement, getMemberStatus } = themeRuntime();
    if (!memberFetcher) {
      memberSyncing = false;
      return { syncing: false, member: getMemberStatus() };
    }
    const previous = getMemberStatus();
    const remote = await memberFetcher();
    if (typeof remote === 'boolean') {
      applyRemoteEntitlement({ is_member: remote });
    } else if (remote && typeof remote === 'object') {
      applyRemoteEntitlement(remote);
    }
    const next = getMemberStatus();
    if (previous && !next) {
      notify({ title: THEME_FAULT_TOAST.memberExpired });
    }
    memberSyncing = false;
    return { syncing: false, member: next };
  } catch {
    memberSyncing = false;
    return { syncing: false, stale: true, kind: THEME_FAULT_KIND.NETWORK };
  }
}

export async function flushThemeCloudQueue() {
  if (!isLoggedIn()) return { ok: true, skipped: 'guest' };
  const payload = readThemeStorage('ui_theme_pack_cloud');
  if (!payload) return { ok: true, skipped: 'empty' };
  if (!cloudFlusher) {
    return { ok: false, reason: 'unbound', kind: THEME_FAULT_KIND.NETWORK };
  }
  try {
    const serialized = JSON.stringify(payload);
    const result = await cloudFlusher(payload);
    if (result?.ok === false || result?.syncFailed) {
      return {
        ok: false,
        syncFailed: Boolean(result?.syncFailed),
        kind: THEME_FAULT_KIND.NETWORK,
      };
    }
    const current = readThemeStorage('ui_theme_pack_cloud');
    if (JSON.stringify(current) === serialized) {
      try {
        uni.removeStorageSync('ui_theme_pack_cloud');
      } catch {
        // A completed sync remains harmless if queue cleanup is unavailable.
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, kind: THEME_FAULT_KIND.NETWORK };
  }
}

export function scheduleThemeCloudFlush({ social = false } = {}) {
  if (!isLoggedIn()) return { queued: false };
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    const result = await flushThemeCloudQueue();
    if (!result.ok) {
      notify({
        title: social ? THEME_FAULT_TOAST.socialSyncFail : THEME_FAULT_TOAST.syncFail,
      });
      trackThemeFault('sync');
    }
  }, 300);
  return { queued: true };
}

export function bindThemeNetworkFlush() {
  if (networkBound || typeof uni === 'undefined' || typeof uni.onNetworkStatusChange !== 'function') {
    return;
  }
  networkBound = true;
  uni.onNetworkStatusChange((status) => {
    if (!status?.isConnected) return;
    flushThemeCloudQueue();
    if (!catalogFetcher) return;
    loadThemeCatalog().then((result) => {
      if (!result?.ok || !result.data) return;
      themeRuntime().mergeRemoteCatalog(result.data);
    }).catch(() => {
      // Keep the current catalog; the next page show can retry.
    });
  });
}

export function notifyThemeQuota() {
  notify({ title: THEME_FAULT_TOAST.quota });
}

export function notifyThemeSync(result, { social = false } = {}) {
  if (result?.reason === 'quota') {
    notifyThemeQuota();
    return;
  }
  if (result?.ok && result.persisted === false && result.reason === 'quota') {
    notifyThemeQuota();
  }
  if (social && result?.syncFailed) {
    notify({ title: THEME_FAULT_TOAST.socialSyncFail });
  }
}

export function captureGuestThemeSnapshot(snapshot) {
  if (isLoggedIn()) return { ok: false, reason: 'authed' };
  return writeThemeStorage(THEME_GUEST_SNAP_KEY, {
    ...snapshot,
    at: Date.now(),
  });
}

export function guestThemeSnapshot() {
  const saved = readThemeStorage(THEME_GUEST_SNAP_KEY);
  if (!saved || typeof saved !== 'object') return null;
  const dressCount = Object.keys(saved.localDress || {}).length;
  const favoriteCount = Object.values(saved.favorites || {})
    .reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0);
  const dirty = (saved.themeId && saved.themeId !== 'default')
    || dressCount > 0
    || (saved.outfits || []).length > 0
    || (saved.recent || []).length > 0
    || favoriteCount > 0;
  return dirty ? saved : null;
}

export function clearThemeLocalState() {
  [
    ...THEME_STORAGE_KEYS,
    THEME_ACCOUNT_KEY,
    THEME_GUEST_SNAP_KEY,
    THEME_CATALOG_CACHE_KEY,
    THEME_CATALOG_VERSION_KEY,
    'ui_theme_analytics_queue',
  ]
    .forEach((key) => {
      try {
        uni.removeStorageSync(key);
      } catch {
        // ignore
      }
    });
  try {
    onThemeLocalCleared?.();
  } catch {
    // Session reset must not block logout.
  }
}

export async function handleThemeAccountLogin(userId) {
  const nextId = String(userId || '');
  const previous = String(readThemeStorage(THEME_ACCOUNT_KEY) || '');
  if (previous && nextId && previous !== nextId) {
    clearThemeLocalState();
    writeThemeStorage(THEME_ACCOUNT_KEY, nextId);
    return { switched: true, merge: null, kind: THEME_FAULT_KIND.USER };
  }
  writeThemeStorage(THEME_ACCOUNT_KEY, nextId);
  const guest = guestThemeSnapshot();
  if (guest) {
    return { switched: false, merge: guest, kind: THEME_FAULT_KIND.USER };
  }
  return { switched: false, merge: null };
}

export async function applyThemeMergeChoice(choice, snapshot) {
  const {
    mergeGuestThemeSnapshot,
    persistActiveTheme,
    persistLocalDress,
    setOverlayLocalDress,
    getDefaultThemeId,
    pullThemeCloudState,
  } = themeRuntime();
  if (choice === 'cloud' || choice === 'merge') {
    writeThemeStorage(THEME_GUEST_SNAP_KEY, '');
    try {
      const pulled = await pullThemeCloudState();
      if (!pulled?.ok) throw new Error(pulled?.reason || 'cloud');
      if (choice === 'merge') {
        const merged = mergeGuestThemeSnapshot(snapshot);
        if (!merged.ok) throw new Error(merged.reason || 'merge');
      }
    } catch (error) {
      writeThemeStorage(THEME_GUEST_SNAP_KEY, snapshot || {});
      return {
        ok: false,
        choice,
        reason: error?.message || 'network',
        kind: THEME_FAULT_KIND.NETWORK,
      };
    }
    return { ok: true, choice };
  }
  if (choice === 'local') {
    setOverlayLocalDress(false);
    const themeId = snapshot?.themeId || getDefaultThemeId();
    const themeResult = await persistActiveTheme(themeId);
    const dressResults = await Promise.all(
      Object.entries(snapshot?.localDress || {}).map(([groupId, itemId]) => (
        persistLocalDress(groupId, itemId)
      )),
    );
    if (!themeResult?.ok || dressResults.some((result) => !result?.ok)) {
      return {
        ok: false,
        choice,
        reason: 'apply',
        kind: THEME_FAULT_KIND.USER,
      };
    }
    setOverlayLocalDress(Boolean(snapshot?.overlay));
    writeThemeStorage(THEME_GUEST_SNAP_KEY, '');
    return { ok: true, choice };
  }
  return { ok: false, reason: 'choice' };
}
