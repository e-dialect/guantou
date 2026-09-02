import { goCanComments, goNameplateComments, goNotFound } from '@/services/navigation';

/*
 * CommentSheet 宿主注册（单宿主契约，见 #257）：
 * - 当前仅首页沉浸流挂载一个 CommentSheet，注册顺序 == 页面栈顺序，
 *   activeHost() 取最后注册者；
 * - 若未来引入第二个使用方，须显式升级为单宿主赋值或按页面栈管理，
 *   否则可能出现面板开到非栈顶宿主的静默错误。
 */
const hosts = [];

export function registerCommentSheetHost(host) {
  if (!host || hosts.includes(host)) return;
  hosts.push(host);
}

export function unregisterCommentSheetHost(host) {
  const index = hosts.indexOf(host);
  if (index >= 0) hosts.splice(index, 1);
}

function activeHost() {
  return hosts[hosts.length - 1] || null;
}

/**
 * 打开半屏评论区（见 #219）。targetType: 'can' | 'nameplate'；
 * theme: 'immersive'（首页沉浸流深色）| 'default'（常规 Token）。
 * 尚未挂载 CommentSheet 时退回整页跳转，保证旧页面不回归。
 */
export function openCommentSheet({
  targetType,
  targetId,
  theme = 'default',
} = {}) {
  const host = activeHost();
  if (host && typeof host.open === 'function') {
    host.open({ targetType, targetId, theme });
    return;
  }
  if (targetType === 'nameplate') {
    goNameplateComments(targetId);
    return;
  }
  if (targetType === 'can') {
    goCanComments(targetId);
    return;
  }
  // 未知目标类型（含 undefined）提前失败，避免带空/错误 id 跳转（#257）。
  goNotFound();
}

export function closeCommentSheet() {
  const host = activeHost();
  if (host && typeof host.close === 'function') host.close();
}

/** 面板当前是否激活；供返回键拦截等场景判断是否先关闭面板（#255）。 */
export function isCommentSheetActive() {
  const host = activeHost();
  return Boolean(host && typeof host.isActive === 'function' && host.isActive());
}

export default {
  closeCommentSheet,
  isCommentSheetActive,
  openCommentSheet,
  registerCommentSheetHost,
  unregisterCommentSheetHost,
};
