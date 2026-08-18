import { getTodayCan as getTodayCanApi, listCans } from '@/services/guantou';

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

export async function getTodayCan() {
  try {
    return await getTodayCanApi();
  } catch (error) {
    const response = await listCans({ feed: 'recommended', page: 1, page_size: 1 });
    const fallback = (response.results || [])[0];
    if (!fallback) throw new Error('no today can available');
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
