const DEFAULT_ERROR_MESSAGES = {
  0: '网络错误',
  400: '请求参数有误',
  401: '请先登录！',
  403: '没有权限！',
  404: '请求资源不存在',
  500: '服务器内部错误',
};

const MAX_TOAST_TITLE_LENGTH = 32;
let loadingReferences = 0;

function truncateTitle(title) {
  const normalized = String(title || '').trim();
  if (normalized.length <= MAX_TOAST_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TOAST_TITLE_LENGTH - 1)}…`;
}

export function notify({
  title,
  icon = 'none',
  duration = 2000,
  mask = false,
} = {}) {
  const normalizedTitle = truncateTitle(title);
  if (!normalizedTitle) return;
  uni.showToast({
    title: normalizedTitle,
    icon,
    duration,
    mask,
  });
}

export function notifySuccess(title) {
  notify({ title, icon: 'success' });
}

export function errorMessage(error, fallback = '') {
  const statusCode = error && error.statusCode ? error.statusCode : 0;
  return (error && error.message)
    || DEFAULT_ERROR_MESSAGES[statusCode]
    || fallback
    || `错误代码${statusCode}`;
}

export function notifyError(error, fallback = '') {
  notify({
    title: errorMessage(error, fallback),
    icon: 'error',
  });
}

export function showLoading(title = '加载中') {
  // 只在 0→1 时打开原生 Loading，避免并发请求互相提前关闭。
  if (loadingReferences === 0) {
    uni.showLoading({
      title,
      mask: true,
    });
  }
  loadingReferences += 1;
}

export function hideLoading() {
  if (loadingReferences === 0) return;
  loadingReferences -= 1;
  // 只在最后一个请求结束（1→0）时关闭。
  if (loadingReferences === 0) uni.hideLoading();
}

export function resetLoading() {
  loadingReferences = 0;
}

export default {
  errorMessage,
  hideLoading,
  notify,
  notifyError,
  notifySuccess,
  resetLoading,
  showLoading,
};
