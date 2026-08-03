import { BASE_URL } from '@/const/urls';
import { toLoginPage } from '@/routers/login';
import {
  hideLoading as hideGlobalLoading,
  notifyError as notifyGlobalError,
  showLoading as showGlobalLoading,
} from '@/services/feedback';

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
  showGlobalLoading(options.loadingTitle);
}

function hideLoading(options) {
  if (!options.loading) return;
  hideGlobalLoading();
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
  notifyGlobalError(error);
  if (error.statusCode === 401 && options.redirectOnUnauthorized) {
    setTimeout(() => {
      toLoginPage();
    }, 1000);
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
