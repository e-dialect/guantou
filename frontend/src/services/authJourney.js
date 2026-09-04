import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  saveInterceptIntent,
} from '@/services/authGuard';
import {
  openPage,
  routeDestination,
  ROUTES,
} from '@/services/navigation';

export const AUTH_DESTINATION_KINDS = {
  ADJACENT_CAN_DRAFT: 'adjacent_can_draft',
  DEFAULT: 'default',
  FALLBACK: 'fallback',
  URL: 'url',
};

export function resolveAuthDestination(intent) {
  if (!intent) return { kind: AUTH_DESTINATION_KINDS.DEFAULT };

  const context = intent.context || {};
  if (intent.voluntary || intent.action === 'open_mine') {
    return routeDestination(ROUTES.mine);
  }

  if (intent.action === 'open_can_library') {
    return routeDestination(ROUTES.canLibrary);
  }

  if (intent.action === 'record_can') {
    if (context.page === 'can_create' && context.returnRoute === ROUTES.canCreate) {
      return {
        kind: AUTH_DESTINATION_KINDS.ADJACENT_CAN_DRAFT,
        ownerScope: context.ownerScope || '',
      };
    }
    if (context.page === 'flavor_detail' && context.flavorId) {
      return routeDestination(ROUTES.canCreate, {
        flavor: context.flavorId,
        flavor_name: context.flavorName,
      });
    }
    if (context.page === 'circle_detail' && context.dialectId) {
      return routeDestination(ROUTES.canCreate, { dialect: context.dialectId });
    }
    if (context.page === 'discovery') {
      return routeDestination(ROUTES.discovery);
    }
    return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
  }

  if (intent.action === 'record_recording') {
    return routeDestination(ROUTES.record, {
      entry_id: context.entryId || undefined,
    });
  }

  if (intent.action === 'attest_usage' && context.entryId) {
    return routeDestination(ROUTES.entryDetail, { id: context.entryId });
  }

  if (intent.action === 'nameplate_support') {
    if (!context.nameplateId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.nameplateDetail, {
      id: context.nameplateId,
      resume: 'support',
    });
  }

  if (intent.action === 'nameplate_create' && context.canId) {
    return routeDestination(ROUTES.nameplateCreate, {
      can_id: context.canId,
      reference_id: context.nameplateId,
    });
  }

  if (intent.action === 'nameplate_comment' && context.nameplateId) {
    return routeDestination(ROUTES.nameplateComments, { id: context.nameplateId });
  }

  if (intent.action === 'dm') {
    if (!context.userId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.mailSend, { id: context.userId });
  }

  if (intent.action === 'follow') {
    if (!context.userId && context.canId) {
      return routeDestination(ROUTES.canDetail, { id: context.canId });
    }
    if (!context.userId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.userDetail, { id: context.userId });
  }

  if (intent.action === 'circle_join' && context.circleId) {
    return routeDestination(ROUTES.circleDetail, { id: context.circleId });
  }

  if (intent.action === 'comment' && context.canId) {
    return routeDestination(ROUTES.canComments, { id: context.canId });
  }

  if (intent.action === 'comment_like' && context.page === 'can_comments') {
    // 评论点赞登录后回跳评论线程，而非罐头详情（#248）。
    if (!context.canId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.canComments, { id: context.canId });
  }

  if (intent.action === 'like' || intent.action === 'comment_like') {
    if (!context.canId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.canDetail, { id: context.canId });
  }

  if (intent.action === 'use_same' && context.canId) {
    return routeDestination(ROUTES.postCompose, { can_id: context.canId });
  }

  if (intent.action === 'shelf_create') {
    return routeDestination(ROUTES.shelves);
  }

  if (intent.action === 'shelf_edit' && context.shelfId) {
    return routeDestination(ROUTES.shelfDetail, { id: context.shelfId });
  }

  if (intent.action === 'pronunciation_create' && context.flavorId) {
    return routeDestination(ROUTES.pronunciationCreate, { flavor_id: context.flavorId });
  }

  return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
}

export function openLoginFromMine() {
  saveInterceptIntent({
    action: 'open_mine',
    context: { page: 'mine' },
    voluntary: true,
  });
  toLoginPage();
}

export function cancelLoginToSearch() {
  clearInterceptIntent();
  openPage(ROUTES.search, {}, { reset: true });
}

export default {
  AUTH_DESTINATION_KINDS,
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
};
