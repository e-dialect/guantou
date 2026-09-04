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
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
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

  it('safely falls back for a protected action without an implemented destination', () => {
    peekInterceptIntent.mockReturnValue({
      action: 'like',
      context: { page: 'flavor_details' },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/index' });
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });

  it('discards a stale can-create intent and returns home', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/flavors/details' },
      { route: 'pages/login/login' },
    ]);

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/index' });
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });

  it('opens a flavor-scoped can form without replaying submission', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/flavors/details' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({
      action: 'record_can',
      context: { page: 'flavor_detail', flavorId: 12, flavorName: '月亮' },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?flavor=12&flavor_name=%E6%9C%88%E4%BA%AE',
    });
  });

  it('returns to the nameplate and resumes interrupted support', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/nameplates/details' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({
      action: 'nameplate_support',
      context: { page: 'can_detail', canId: 18, nameplateId: 4 },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/nameplates/details?id=4&resume=support',
    });
  });

  it('returns voluntary login to the adjacent mine page', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/users/me' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({
      action: 'open_mine',
      context: { page: 'mine' },
      voluntary: true,
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
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

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).not.toHaveBeenCalled();
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/index?status=me' });
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '该草稿属于其他账号',
      icon: 'none',
    });
  });

  it('resumes a dm intent to the mail send page with the recipient', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/users/details' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({
      action: 'dm',
      context: { page: 'user_detail', userId: 9 },
    });

    expect(resumeInterruptedPageAfterLogin('7')).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/mails/send?id=9',
    });
  });

  it('uses the normal post-login destination without an interrupted action', () => {
    peekInterceptIntent.mockReturnValue(null);

    expect(resumeInterruptedPageAfterLogin('7')).toBe(false);
    expect(clearInterceptIntent).not.toHaveBeenCalled();
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });
});
