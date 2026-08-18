import { getDiscovery, listCans } from '@/services/guantou';

export const HOME_FEED_TABS = [
  { key: 'today', label: '今日罐' },
  { key: 'dialect', label: '同方言' },
  { key: 'following', label: '关注' },
  { key: 'recommended', label: '推荐' },
];

const FEED_PAGE_SIZE = 8;
const FEED_PARAM_BY_TAB = {
  dialect: 'dialect',
  following: 'following',
  recommended: 'recommended',
};

const TODAY_CAN_STORAGE_KEY = 'home_today_can';

/**
 * 首页内容流列表：四 tab 映射后端 feed 参数（今日罐走独立策略，见 getTodayCan）。
 */
export function listHomeFeed(tab, page = 1) {
  const feed = FEED_PARAM_BY_TAB[tab] || 'recommended';
  return listCans({ feed, page, page_size: FEED_PAGE_SIZE });
}

function normalizedPreviews(list) {
  return (Array.isArray(list) ? list : []).slice(0, 3);
}

/**
 * 首页列表接口必须一次给齐铭牌摘要，禁止轮播卡片按罐补请求。
 */
export function getNameplatePreview(canId, can = null) {
  const previews = normalizedPreviews(can?.nameplate_previews);
  const total = Number(can?.nameplate_total ?? can?.nameplate_count ?? previews.length);
  return { previews, total };
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * 本地日期序号：与 todayStamp 缓存键同源（都按本地日历日），
 * 避免 UTC epoch 天数在 UTC+ 时区导致轮换延迟与跨日重复。
 */
function localDaySerial() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

function readTodayCache() {
  try {
    const raw = uni.getStorageSync(TODAY_CAN_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached && cached.date === todayStamp() && cached.can) return cached.can;
  } catch (error) {
    uni.removeStorageSync(TODAY_CAN_STORAGE_KEY);
  }
  return null;
}

function writeTodayCache(can) {
  try {
    uni.setStorageSync(TODAY_CAN_STORAGE_KEY, JSON.stringify({ date: todayStamp(), can }));
  } catch (error) {
    // 缓存失败不影响主流程
  }
}

/**
 * 今日罐（v1 前端策略）：getDiscovery().hot_cans 按当日日期序确定性轮转，
 * storage 当日键缓存；失败回退推荐流首条。
 */
export async function getTodayCan() {
  const cached = readTodayCache();
  if (cached) return cached;

  try {
    const discovery = await getDiscovery();
    const hotCans = discovery.hot_cans || [];
    if (!hotCans.length) throw new Error('no hot cans');
    const can = hotCans[localDaySerial() % hotCans.length];
    writeTodayCache(can);
    return can;
  } catch (error) {
    const response = await listCans({ feed: 'recommended', page: 1, page_size: 1 });
    const fallback = (response.results || [])[0];
    if (!fallback) throw new Error('no today can available');
    writeTodayCache(fallback);
    return fallback;
  }
}

/**
 * 默认 tab：已设置主方言 → 同方言；否则（含游客）→ 推荐。
 */
export function resolveDefaultTab(userInfo = null) {
  const app = typeof getApp === 'function' ? getApp() : null;
  const info = userInfo || (app ? app.globalData && app.globalData.userInfo : null) || null;
  return info && info.primary_dialect ? 'dialect' : 'recommended';
}

export default {
  HOME_FEED_TABS,
  getNameplatePreview,
  getTodayCan,
  listHomeFeed,
  resolveDefaultTab,
};
