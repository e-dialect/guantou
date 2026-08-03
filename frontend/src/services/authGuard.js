import { toLoginPage } from '@/routers/login';
import { notify } from '@/services/feedback';

export const PROTECTED_ACTIONS = {
  record_can: '录一罐',
  publish_post: '发布',
  use_same: '用同款',
  like: '点赞',
  comment: '评论',
  follow: '关注',
  circle_join: '加入方言圈',
  dm: '私信',
  tab_publish: '发布',
  tab_like: '点赞',
  tab_follow: '关注流',
  nameplate_support: '支持铭牌',
  nameplate_create: '贴铭牌',
};

const STORAGE_KEY = 'auth_intercept_intent';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isProtectedAction(action) {
  return Object.prototype.hasOwnProperty.call(PROTECTED_ACTIONS, action);
}

export function actionLabel(action) {
  return PROTECTED_ACTIONS[action] || action || '';
}

export function isLoggedIn() {
  return Boolean(uni.getStorageSync('token'));
}

export function saveInterceptIntent(intent) {
  const payload = {
    action: intent.action,
    context: intent.context || {},
    createdAt: intent.createdAt || Date.now(),
    voluntary: Boolean(intent.voluntary),
  };
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function peekInterceptIntent() {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (!raw) return null;
  try {
    const intent = JSON.parse(raw);
    if (!intent.createdAt || Date.now() - intent.createdAt > MAX_AGE_MS) {
      uni.removeStorageSync(STORAGE_KEY);
      return null;
    }
    return intent;
  } catch (error) {
    uni.removeStorageSync(STORAGE_KEY);
    return null;
  }
}

export function clearInterceptIntent() {
  uni.removeStorageSync(STORAGE_KEY);
}

export function requireAuth(action, context = {}) {
  if (!isProtectedAction(action)) return true;
  if (isLoggedIn()) return true;
  saveInterceptIntent({ action, context });
  notify({ title: '请先登录' });
  toLoginPage();
  return false;
}

export default {
  PROTECTED_ACTIONS,
  actionLabel,
  clearInterceptIntent,
  isLoggedIn,
  isProtectedAction,
  peekInterceptIntent,
  requireAuth,
  saveInterceptIntent,
};
