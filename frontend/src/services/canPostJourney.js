import { requireAuth } from '@/services/authGuard';
import {
  goPostCompose,
  goPostDetail,
  pageUrl,
  ROUTES,
} from '@/services/navigation';

export function useSameUrl(canId) {
  return pageUrl(ROUTES.postCompose, { can_id: canId });
}

export function startUseSame(canId, context = {}) {
  if (!canId) return false;
  if (!requireAuth('use_same', {
    page: context.page || 'can_detail',
    canId,
    postId: context.postId,
  })) return false;
  goPostCompose(canId);
  return true;
}

export function openCanPost(postId) {
  if (!postId) return false;
  goPostDetail(postId);
  return true;
}

export default { openCanPost, startUseSame, useSameUrl };
