import { isLoggedIn } from '@/services/authGuard';
import { isWechatMiniProgram } from '@/services/platform';
import {
  THEME_EMPTY_ACTION_LABELS,
  THEME_EMPTY_SCENE_LABELS,
} from '@/services/themeAnalyticsLabels';
import { themeRuntime } from '@/services/themeRuntime';

export const THEME_ANALYTICS_EVENTS = {
  ENTER: 'theme_center_enter',
  LEAVE: 'theme_center_leave',
  TAB_SWITCH: 'theme_tab_switch',
  ITEM_DETAIL: 'theme_item_enter_detail',
  LIST_SCROLL: 'theme_list_scroll',
  FILTER_CLICK: 'theme_filter_click',
  SEARCH: 'theme_search',
  HOT_SEARCH: 'theme_hot_search_click',
  COLLECT: 'theme_collect_click',
  SHARE: 'theme_share_click',
  PREVIEW: 'theme_preview_click',
  APPLY: 'theme_apply_click',
  GET: 'theme_get_click',
  SAVE_MIX: 'theme_save_mix',
  MIX_MANAGE: 'theme_mix_manage',
  APPLY_MIX: 'theme_apply_mix',
  RESET_ALL: 'theme_reset_all',
  SWITCH_CONFLICT: 'theme_switch_conflict',
  UNSUPPORTED_ENV: 'theme_unsupported_env',
  APPLY_INVALID: 'theme_apply_invalid_item',
  EMPTY_SHOW: 'theme_empty_show',
  EMPTY_CLICK: 'theme_empty_click',
  FAULT: 'theme_fault',
  PERF_LIST_READY: 'theme_perf_list_ready',
  PERF_SCROLL: 'theme_perf_scroll',
  PERF_STYLE: 'theme_perf_style',
  PERF_ERROR: 'theme_perf_error',
};

export const THEME_TAB_LABELS = {
  global: '全局主题',
  local: '局部装扮',
  favorites: '我的收藏',
  mine: '我的装扮',
};

export const THEME_ITEM_TYPES = {
  theme: '全局主题',
  dress: '局部装扮',
};

export const THEME_SHARE_CHANNELS = {
  friend: 'APP私信',
  wechat: '微信',
  mp_share: '小程序转发',
  copy_link: '复制链接',
  save_poster: '保存海报',
};

export const THEME_PREVIEW_TYPES = {
  detail: '大图预览',
  live: '实时模拟预览',
};

export const THEME_APPLY_RESULTS = {
  success: '成功启用',
  no_permission: '权限不足',
  unsupported_env: '环境不支持',
};

export const THEME_GET_METHODS = {
  member: '会员',
  event: '活动',
  creator: '创作者任务',
};

export const THEME_MIX_ACTIONS = {
  rename: '重命名',
  delete: '删除',
};

export const THEME_FAULT_KINDS = {
  sync: 'sync',
  rate: 'rate',
  mix_cap: 'mix_cap',
};

export const THEME_ANALYTICS_QUEUE_KEY = 'ui_theme_analytics_queue';

const PRIVACY_KEYS = [
  'nickname',
  'phone',
  'telephone',
  'email',
  'token',
  'avatar',
  'user_id',
  'userid',
  'openid',
  'unionid',
  'visitor_id',
  'name',
];

const QUEUE_LIMIT = 200;
const FAULT_GAP_MS = 2000;
const MIN_DWELL_MS = 300;
const MAX_DWELL_MS = 86400000;
const queue = [];
let lastEmptyScene = '';
let lastFaultKind = '';
let lastFaultAt = 0;
let enterAt = 0;

function wechatApi() {
  if (typeof globalThis === 'undefined') return null;
  const api = globalThis.wx;
  return api && typeof api === 'object' ? api : null;
}

function lookupLabel(list, value, fallback = '') {
  const match = (list || []).find((item) => item.value === value);
  return match?.label || fallback || '';
}

export function themeAnalyticsPlatform() {
  return isWechatMiniProgram() ? 'miniprogram' : 'h5';
}

export function themeItemType(kind) {
  return THEME_ITEM_TYPES[kind] || THEME_ITEM_TYPES.theme;
}

export function themeRegionLabel(region) {
  if (!region || region === 'all') return '';
  return lookupLabel(themeRuntime().getDialectRegions(), region, region);
}

export function themeAccessType(item) {
  if (!item) return '';
  return themeRuntime().accessLabel(item.access, item);
}

export function themeDressCategoryLabel(category) {
  if (!category || category === 'all') return '';
  return lookupLabel(themeRuntime().getDressCategories(), category, category);
}

export function describeThemeQuery(query = {}) {
  const regions = (query.regions || [])
    .map((value) => themeRegionLabel(value))
    .filter(Boolean);
  return {
    access_filter: lookupLabel(themeRuntime().getThemeAccessFilters(), query.access, '全部'),
    style_filter: lookupLabel(themeRuntime().getThemeCategories(), query.category, '全部'),
    dress_category: themeDressCategoryLabel(query.dressCategory) || '全部',
    region_tags: regions.join(','),
    sort: lookupLabel(themeRuntime().getThemeSorts(), query.sort, '最新上架'),
  };
}

export function themeItemContext(kind, item, group) {
  const dressGroup = group || themeRuntime().getDressGroup(item?.group);
  return {
    item_id: item?.id || '',
    item_type: themeItemType(kind),
    access_type: themeAccessType(item),
    region_tag: themeRegionLabel(item?.region),
    dress_category: themeDressCategoryLabel(dressGroup?.category),
    catalog_status: themeRuntime().catalogStatus(item),
  };
}

function stripPrivacy(payload = {}) {
  const clean = {};
  Object.keys(payload || {}).forEach((key) => {
    if (PRIVACY_KEYS.includes(key)) return;
    const value = payload[key];
    if (value == null || value === '') return;
    clean[key] = value;
  });
  return clean;
}

export function flattenThemeAnalyticsParams(payload = {}) {
  const flat = {};
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      flat[key] = value.map((item) => String(item)).filter(Boolean).slice(0, 40).join(',');
      return;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      flat[key] = String(value);
      return;
    }
    if (typeof value === 'object') {
      flat[key] = JSON.stringify(value).slice(0, 256);
      return;
    }
    flat[key] = String(value).slice(0, 256);
  });
  return flat;
}

function persistQueueToStorage() {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return;
  try {
    uni.setStorageSync(THEME_ANALYTICS_QUEUE_KEY, queue.slice(-QUEUE_LIMIT));
  } catch {
    // Quota or missing storage must not block the page.
  }
}

function trimQueue() {
  if (queue.length > QUEUE_LIMIT) {
    queue.splice(0, queue.length - QUEUE_LIMIT);
  }
}

function restoreQueueFromStorage() {
  if (queue.length) return;
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return;
  try {
    const saved = uni.getStorageSync(THEME_ANALYTICS_QUEUE_KEY);
    if (!Array.isArray(saved)) return;
    saved.forEach((row) => {
      if (!row || typeof row.event !== 'string') return;
      queue.push({
        event: row.event,
        params: row.params && typeof row.params === 'object' ? row.params : {},
        transport: row.transport || 'web',
        at: Number(row.at) || 0,
      });
    });
    trimQueue();
  } catch {
    // Ignore corrupt cache.
  }
}

function reportWeb(event, params) {
  const record = {
    event,
    params,
    transport: 'web',
    at: Date.now(),
  };
  if (typeof window === 'undefined') return;
  if (typeof window.themeAnalyticsReport === 'function') {
    window.themeAnalyticsReport(record);
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
  const endpoint = window.themeAnalyticsEndpoint;
  if (endpoint && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(record));
    } catch {
      // ignore transport failures; queue still holds the event
    }
  }
}

function reportMiniProgram(event, params) {
  const wxApi = wechatApi();
  if (wxApi && typeof wxApi.reportEvent === 'function') {
    wxApi.reportEvent(event, params);
    return;
  }
  if (typeof uni !== 'undefined' && typeof uni.report === 'function') {
    uni.report(event, params);
  }
}

export function getThemeAnalyticsQueue() {
  return queue.slice();
}

export function resetThemeAnalyticsQueue() {
  queue.length = 0;
  lastEmptyScene = '';
  lastFaultKind = '';
  lastFaultAt = 0;
  enterAt = 0;
}

export function reportThemeEvent(event, payload = {}) {
  const params = flattenThemeAnalyticsParams(stripPrivacy({
    platform: themeAnalyticsPlatform(),
    ...payload,
  }));
  const record = {
    event,
    params,
    transport: themeAnalyticsPlatform() === 'miniprogram' ? 'miniprogram' : 'web',
    at: Date.now(),
  };
  queue.push(record);
  trimQueue();
  if (record.transport === 'miniprogram') {
    reportMiniProgram(event, params);
  } else {
    reportWeb(event, params);
  }
  try {
    Promise.resolve(
      themeRuntime().postThemeEvent(event, params.item_id || payload.item_id || ''),
    ).catch(() => {});
  } catch {
    // Analytics transport must not block the user action.
  }
  return record;
}

export function trackThemeCenterEnter(extra = {}) {
  restoreQueueFromStorage();
  enterAt = Date.now();
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.ENTER, {
    logged_in: isLoggedIn() ? 'logged' : 'guest',
    theme_id: extra.themeId || themeRuntime().getActiveThemeId(),
  });
}

export function trackThemeCenterLeave() {
  const started = enterAt;
  enterAt = 0;
  const dwell = Math.min(Math.max(0, Date.now() - started), MAX_DWELL_MS);
  let record = null;
  if (started && dwell >= MIN_DWELL_MS) {
    record = reportThemeEvent(THEME_ANALYTICS_EVENTS.LEAVE, {
      dwell_ms: dwell,
    });
  }
  persistQueueToStorage();
  return record;
}

export function trackThemeTabSwitch(tab) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.TAB_SWITCH, {
    tab: THEME_TAB_LABELS[tab] || tab,
  });
}

export function trackThemeItemDetail(kind, item, group) {
  return reportThemeEvent(
    THEME_ANALYTICS_EVENTS.ITEM_DETAIL,
    themeItemContext(kind, item, group),
  );
}

export function trackThemeListScroll({
  itemIds = [],
  scrollTop = 0,
  query = {},
} = {}) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.LIST_SCROLL, {
    item_ids: itemIds,
    scroll_top: Math.round(Number(scrollTop) || 0),
    ...describeThemeQuery(query),
  });
}

export function trackThemeFilterClick(query = {}) {
  return reportThemeEvent(
    THEME_ANALYTICS_EVENTS.FILTER_CLICK,
    describeThemeQuery(query),
  );
}

export function trackThemeSearch(keyword, resultCount = 0) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.SEARCH, {
    keyword: String(keyword || '').trim(),
    result_count: Number(resultCount) || 0,
  });
}

export function trackThemeHotSearch(keyword) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.HOT_SEARCH, {
    keyword: String(keyword || '').trim(),
  });
}

export function trackThemeCollect(kind, item, favorited) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.COLLECT, {
    ...themeItemContext(kind, item),
    collect_state: favorited ? '收藏' : '取消收藏',
  });
}

export function trackThemeShare(kind, item, channel) {
  const platform = themeAnalyticsPlatform();
  let resolved = channel;
  if (platform === 'miniprogram' && channel === 'wechat') {
    resolved = 'mp_share';
  }
  if (platform === 'miniprogram' && resolved === 'copy_link') {
    return null;
  }
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.SHARE, {
    item_id: item?.id || '',
    item_type: themeItemType(kind),
    share_channel: THEME_SHARE_CHANNELS[resolved] || resolved,
  });
}

export function trackThemePreview(kind, item, previewType) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.PREVIEW, {
    item_id: item?.id || '',
    item_type: kind ? themeItemType(kind) : '',
    preview_type: THEME_PREVIEW_TYPES[previewType] || previewType,
  });
}

export function trackThemeApply({
  kind,
  item,
  fromHistory = false,
  isMix = false,
  result = 'success',
  permission = '',
} = {}) {
  const payload = {
    ...themeItemContext(kind, item),
    from_history: fromHistory ? '1' : '0',
    is_mix: isMix ? '1' : '0',
    apply_result: THEME_APPLY_RESULTS[result] || result,
  };
  if (permission) {
    payload.permission_type = THEME_GET_METHODS[permission] || permission;
  }
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.APPLY, payload);
}

export function trackThemeGet(kind, item, method) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.GET, {
    item_id: item?.id || '',
    item_type: kind ? themeItemType(kind) : '',
    get_method: THEME_GET_METHODS[method] || method,
  });
}

export function trackThemeSaveMix(outfit) {
  const dressIds = Object.values(outfit?.localDress || {});
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.SAVE_MIX, {
    mix_id: outfit?.id || '',
    theme_id: outfit?.themeId || '',
    dress_ids: dressIds,
  });
}

export function trackThemeMixManage(action, mixId = '') {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.MIX_MANAGE, {
    mix_id: mixId || '',
    mix_action: THEME_MIX_ACTIONS[action] || action,
  });
}

export function trackThemeApplyMix(outfit, { hasUnavailable = false } = {}) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.APPLY_MIX, {
    mix_id: outfit?.id || '',
    has_unavailable: hasUnavailable ? '1' : '0',
  });
}

export function trackThemeResetAll({ themeId, dressCount = 0 } = {}) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.RESET_ALL, {
    theme_id: themeId || themeRuntime().getActiveThemeId(),
    dress_count: Number(dressCount) || 0,
  });
}

export function trackThemeSwitchConflict(enabled) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.SWITCH_CONFLICT, {
    overlay: enabled ? '开启' : '关闭',
  });
}

export function trackThemeUnsupportedEnv(kind, item) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.UNSUPPORTED_ENV, {
    item_id: item?.id || item?.group || '',
    item_type: kind ? themeItemType(kind) : '',
  });
}

export function trackThemeApplyInvalid(kind, item, status) {
  const resolved = status
    || (item?.eventStatus === 'ended' ? '已绝版' : '已下架');
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.APPLY_INVALID, {
    item_id: item?.id || '',
    item_status: resolved,
  });
}

export function trackThemeEmptyShow(scene) {
  const key = String(scene || '').trim();
  if (!key || lastEmptyScene === key) return null;
  lastEmptyScene = key;
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.EMPTY_SHOW, {
    scene: THEME_EMPTY_SCENE_LABELS[key] || key,
  });
}

export function trackThemeEmptyClick(scene, action) {
  const key = String(scene || '').trim();
  const act = String(action || '').trim();
  if (!key) return null;
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.EMPTY_CLICK, {
    scene: THEME_EMPTY_SCENE_LABELS[key] || key,
    empty_action: THEME_EMPTY_ACTION_LABELS[act] || act,
  });
}

export function trackThemeFault(kind) {
  const faultKind = THEME_FAULT_KINDS[kind] || String(kind || '').trim();
  if (!faultKind) return null;
  const now = Date.now();
  if (lastFaultKind === faultKind && now - lastFaultAt < FAULT_GAP_MS) return null;
  lastFaultKind = faultKind;
  lastFaultAt = now;
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.FAULT, {
    fault_kind: faultKind,
  });
}

export function themeDeviceTier() {
  const memory = Number(globalThis?.navigator?.deviceMemory) || 0;
  if (memory && memory <= 2) return 'low';
  if (memory && memory <= 4) return 'mid';
  if (memory) return 'high';
  return 'mid';
}

export function trackThemePerfListReady({
  readyMs = 0,
  fromCache = false,
  itemCount = 0,
} = {}) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.PERF_LIST_READY, {
    ready_ms: Math.max(0, Math.round(Number(readyMs) || 0)),
    from_cache: fromCache ? 'cache' : 'network',
    item_count: Math.max(0, Number(itemCount) || 0),
    device_tier: themeDeviceTier(),
  });
}

export function trackThemePerfStyle({ hydrateMs = 0, layerCount = 0 } = {}) {
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.PERF_STYLE, {
    hydrate_ms: Math.max(0, Math.round(Number(hydrateMs) || 0)),
    layer_count: Math.max(0, Number(layerCount) || 0),
  });
}

export function trackThemePerfError(kind, itemId = '') {
  const errorKind = ['render', 'style_json', 'image'].includes(kind) ? kind : 'render';
  return reportThemeEvent(THEME_ANALYTICS_EVENTS.PERF_ERROR, {
    error_kind: errorKind,
    item_id: itemId || undefined,
  });
}
