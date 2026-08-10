import { requireAuth } from '@/services/authGuard';

export function useSameUrl(canId) {
  return `/pages/posts/compose?can_id=${encodeURIComponent(canId)}`;
}

export function startUseSame(canId, context = {}) {
  if (!canId) return false;
  if (!requireAuth('use_same', {
    page: context.page || 'can_detail',
    canId,
    postId: context.postId,
  })) return false;
  uni.navigateTo({ url: useSameUrl(canId) });
  return true;
}

export function openCanPost(postId) {
  if (!postId) return false;
  uni.navigateTo({
    url: `/pages/posts/details?id=${encodeURIComponent(postId)}`,
  });
  return true;
}

export default { openCanPost, startUseSame, useSameUrl };
