function readStorage(key) {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') {
    return '';
  }
  return uni.getStorageSync(key);
}

export function hydrateAppSessionFromStorage() {
  const currentApp = typeof getApp === 'function' ? getApp() : null;
  const state = currentApp?.globalData;
  if (!state || state.id) return;
  const token = readStorage('token');
  const storedId = readStorage('id');
  if (token && storedId !== undefined && storedId !== null && storedId !== '') {
    state.id = storedId;
  }
}

export function resolveSessionUserId() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const liveId = app?.globalData?.id;
  if (liveId) return liveId;
  const token = readStorage('token');
  const storedId = readStorage('id');
  if (!token || storedId === undefined || storedId === null || storedId === '') {
    return '';
  }
  if (app?.globalData) app.globalData.id = storedId;
  return storedId;
}
