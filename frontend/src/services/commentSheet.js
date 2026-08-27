import { goCanComments, goNameplateComments } from '@/services/navigation';

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
  } else {
    goCanComments(targetId);
  }
}

export function closeCommentSheet() {
  const host = activeHost();
  if (host && typeof host.close === 'function') host.close();
}

export default {
  closeCommentSheet,
  openCommentSheet,
  registerCommentSheetHost,
  unregisterCommentSheetHost,
};
