import { BASE_URL } from '@/const/urls';
import { toLoginPage } from '@/routers/login';

const DEFAULT_OPTIONS = {
  auth: true,
  silent: false,
  redirectOnUnauthorized: true,
  loading: true,
  loadingTitle: '加载中',
};

function resolveOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function authHeaders(enabled) {
  if (!enabled) return {};
  return {
    token: uni.getStorageSync('token'),
  };
}

function buildHeaders(options) {
  return {
    'content-type': 'application/json',
    ...authHeaders(options.auth),
  };
}

function showLoading(options) {
  if (!options.loading) return;
  uni.showLoading({
    title: options.loadingTitle,
    mask: true,
  });
}

function hideLoading(options) {
  if (!options.loading) return;
  uni.hideLoading();
}

export function createApiError(error) {
  const statusCode = error && error.statusCode ? error.statusCode : 0;
  const data = (error && error.data) || {};
  const message = data.msg
    || data.message
    || error.errMsg
    || error.message
    || '';
  return {
    statusCode,
    message,
    data,
    raw: error,
  };
}

function notifyError(error, options) {
  if (options.silent) return;
  switch (error.statusCode) {
    case 401:
      uni.showToast({
        title: error.message || '请先登录！',
        icon: 'error',
      });
      if (options.redirectOnUnauthorized) {
        setTimeout(() => {
          toLoginPage();
        }, 1000);
      }
      break;
    case 403:
      uni.showToast({
        title: error.message || '没有权限！',
        icon: 'error',
      });
      break;
    case 404:
      uni.showToast({
        title: error.message || '请求资源不存在',
        icon: 'error',
      });
      break;
    case 500:
      uni.showToast({
        title: error.message || '服务器内部错误',
        icon: 'error',
      });
      break;
    case 0:
      uni.showToast({
        title: '网络错误',
        icon: 'error',
      });
      break;
    default:
      uni.showToast({
        title: error.message || `错误代码${error.statusCode}`,
        icon: 'error',
      });
      break;
  }
}

export function request(method = 'GET', url = '', data = {}, options = {}) {
  const resolvedOptions = resolveOptions(options);
  showLoading(resolvedOptions);
  return new Promise((resolve, reject) => {
    uni.request({
      method,
      url: BASE_URL + url,
      data,
      header: buildHeaders(resolvedOptions),
      dataType: 'json',
    }).then((res) => {
      hideLoading(resolvedOptions);
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(res.data);
        return;
      }
      const error = createApiError(res);
      notifyError(error, resolvedOptions);
      reject(error);
    }).catch((rawError) => {
      hideLoading(resolvedOptions);
      const error = createApiError(rawError);
      notifyError(error, resolvedOptions);
      reject(error);
    });
  });
}

function parseUploadResponseData(data) {
  if (typeof data !== 'string') return data || {};
  if (!data.length) return {};
  try {
    return JSON.parse(data);
  } catch (error) {
    return { data };
  }
}

export function upload(file, options = {}) {
  const resolvedOptions = resolveOptions({
    loadingTitle: '上传中……',
    ...options,
  });
  showLoading(resolvedOptions);
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}${options.url || '/files'}`,
      filePath: file,
      name: options.name || 'file',
      header: authHeaders(resolvedOptions.auth),
    }).then((res) => {
      hideLoading(resolvedOptions);
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(parseUploadResponseData(res.data));
        return;
      }
      const error = createApiError(res);
      notifyError(error, resolvedOptions);
      reject(error);
    }).catch((rawError) => {
      hideLoading(resolvedOptions);
      const error = createApiError(rawError);
      notifyError(error, resolvedOptions);
      reject(error);
    });
  });
}

export default {
  request,
  upload,
  createApiError,
};
