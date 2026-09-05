export const LISTEN_FEED_TABS = Object.freeze([
  { key: 'today', label: '新近' },
  { key: 'dialect', label: '本地' },
  { key: 'phrase', label: '短语' },
  { key: 'recommended', label: '全部' },
]);

export function resolveDefaultListenTab(userInfo = null) {
  const app = typeof getApp === 'function' ? getApp() : null;
  const info = userInfo || app?.globalData?.userInfo || null;
  return info?.primary_dialect ? 'dialect' : 'recommended';
}

export default { LISTEN_FEED_TABS, resolveDefaultListenTab };
