import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  saveInterceptIntent,
} from '@/services/authGuard';

export const AUTH_DESTINATION_KINDS = {
  ADJACENT_CAN_DRAFT: 'adjacent_can_draft',
  DEFAULT: 'default',
  FALLBACK: 'fallback',
  URL: 'url',
};

function canDetailsUrl(canId) {
  return canId ? `/pages/cans/details?id=${encodeURIComponent(canId)}` : '';
}

function userDetailsUrl(userId) {
  return userId ? `/pages/users/details?id=${encodeURIComponent(userId)}` : '';
}

export function resolveAuthDestination(intent) {
  if (!intent) return { kind: AUTH_DESTINATION_KINDS.DEFAULT };

  const context = intent.context || {};
  if (intent.voluntary || intent.action === 'open_mine') {
    return {
      kind: AUTH_DESTINATION_KINDS.URL,
      route: 'pages/users/me',
      url: '/pages/users/me',
    };
  }

  if (intent.action === 'record_can') {
    if (context.page === 'can_create' && context.returnRoute === '/pages/cans/create') {
      return {
        kind: AUTH_DESTINATION_KINDS.ADJACENT_CAN_DRAFT,
        ownerScope: context.ownerScope || '',
      };
    }
    if (context.page === 'flavor_detail' && context.flavorId) {
      const name = context.flavorName
        ? `&flavor_name=${encodeURIComponent(context.flavorName)}`
        : '';
      return {
        kind: AUTH_DESTINATION_KINDS.URL,
        route: 'pages/cans/create',
        url: `/pages/cans/create?flavor=${encodeURIComponent(context.flavorId)}${name}`,
      };
    }
    return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
  }

  if (intent.action === 'nameplate_support' || intent.action === 'nameplate_create') {
    const url = canDetailsUrl(context.canId);
    if (!url) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return {
      kind: AUTH_DESTINATION_KINDS.URL,
      route: 'pages/cans/details',
      url,
    };
  }

  if (intent.action === 'follow') {
    const url = userDetailsUrl(context.userId);
    if (!url) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return {
      kind: AUTH_DESTINATION_KINDS.URL,
      route: 'pages/users/details',
      url,
    };
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
  uni.reLaunch({ url: '/pages/search' });
}

export default {
  AUTH_DESTINATION_KINDS,
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
};
