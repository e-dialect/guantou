import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  peekInterceptIntent: vi.fn(),
}));

vi.mock('@/services/canDrafts', () => ({
  claimAnonymousCanDrafts: vi.fn(),
  getCanDraftOwnerScope: vi.fn(() => 'anonymous:session-1'),
}));

import { clearInterceptIntent, peekInterceptIntent } from '@/services/authGuard';
import { resumeInterruptedPageAfterLogin } from '@/services/login';

describe('login draft resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn((key) => (key === 'id' ? '7' : '')),
      navigateBack: vi.fn(),
      showToast: vi.fn(),
    };
    globalThis.getCurrentPages = vi.fn(() => [
      { route: 'pages/cans/create' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({
      action: 'record_can',
      context: {
        page: 'can_create',
        returnRoute: '/pages/cans/create',
        ownerScope: 'anonymous:session-1',
      },
    });
  });

  it('returns only to the adjacent can form for a matching intent', () => {
    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it('does not consume another protected action intent', () => {
    peekInterceptIntent.mockReturnValue({
      action: 'like',
      context: { page: 'flavor_details' },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(false);
    expect(clearInterceptIntent).not.toHaveBeenCalled();
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });

  it('discards a stale can-create intent after login from an unrelated page stack', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/flavors/details' },
      { route: 'pages/login/login' },
    ]);

    expect(resumeInterruptedPageAfterLogin('7')).toBe(false);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });

  it('blocks a draft that belongs to a different signed-in account', () => {
    peekInterceptIntent.mockReturnValue({
      action: 'record_can',
      context: {
        page: 'can_create',
        returnRoute: '/pages/cans/create',
        ownerScope: 'user:6',
      },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(false);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).not.toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '该草稿属于其他账号',
      icon: 'none',
    });
  });

  it('uses the normal post-login destination without an interrupted action', () => {
    peekInterceptIntent.mockReturnValue(null);

    expect(resumeInterruptedPageAfterLogin('7')).toBe(false);
    expect(clearInterceptIntent).not.toHaveBeenCalled();
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });
});
