import { toLoginPage } from '@/routers/login';
import { notify } from '@/services/feedback';

export const PROTECTED_ACTIONS = {
  record_can: '录一罐',
  publish_post: '发布',
  use_same: '用同款',
  like: '点赞',
  comment: '评论',
  comment_like: '支持评论',
  follow: '关注',
  circle_join: '加入方言圈',
  dm: '私信',
  tab_publish: '发布',
  tab_like: '点赞',
  tab_follow: '关注流',
  nameplate_support: '支持铭牌',
  nameplate_create: '贴铭牌',
  nameplate_comment: '评论铭牌',
  pronunciation_create: '添加读音',
  shelf_create: '创建集盒',
  shelf_edit: '编辑集盒',
  open_mine: '查看我的',
  open_can_library: '查看罐头库',
};

const STORAGE_KEY = 'auth_intercept_intent';
const INTENT_VERSION = 1;
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
    version: INTENT_VERSION,
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
    if (
      intent.version !== INTENT_VERSION
      || !isProtectedAction(intent.action)
      || !intent.createdAt
      || Date.now() - intent.createdAt > MAX_AGE_MS
      || !intent.context
      || typeof intent.context !== 'object'
      || Array.isArray(intent.context)
    ) {
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
