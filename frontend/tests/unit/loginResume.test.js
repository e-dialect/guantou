import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  peekInterceptIntent: vi.fn(),
}));

import { clearInterceptIntent, peekInterceptIntent } from '@/services/authGuard';
import { resumeInterruptedPageAfterLogin } from '@/services/login';

describe('login draft resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { navigateBack: vi.fn() };
    globalThis.getCurrentPages = vi.fn(() => [
      { route: 'pages/cans/create' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue(null);
  });

  it('returns to a can form after an expired-login interruption', () => {
    expect(resumeInterruptedPageAfterLogin()).toBe(true);
    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it('returns to an intercepted protected action', () => {
    getCurrentPages.mockReturnValue([
      { route: 'pages/flavors/details' },
      { route: 'pages/login/login' },
    ]);
    peekInterceptIntent.mockReturnValue({ action: 'record_can' });

    expect(resumeInterruptedPageAfterLogin()).toBe(true);
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it('uses the normal post-login destination without an interrupted action', () => {
    getCurrentPages.mockReturnValue([{ route: 'pages/login/login' }]);

    expect(resumeInterruptedPageAfterLogin()).toBe(false);
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });
});
