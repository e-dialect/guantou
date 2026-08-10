import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  saveInterceptIntent: vi.fn(),
}));

import { toLoginPage } from '@/routers/login';
import { clearInterceptIntent, saveInterceptIntent } from '@/services/authGuard';
import {
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
} from '@/services/authJourney';

describe('auth journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { reLaunch: vi.fn() };
  });

  it('records voluntary mine login before opening the shared login page', () => {
    openLoginFromMine();

    expect(saveInterceptIntent).toHaveBeenCalledWith({
      action: 'open_mine',
      context: { page: 'mine' },
      voluntary: true,
    });
    expect(toLoginPage).toHaveBeenCalledTimes(1);
  });

  it('clears a cancelled intent and relaunches public search', () => {
    cancelLoginToSearch();

    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/search' });
  });

  it('rejects incomplete nameplate context', () => {
    expect(resolveAuthDestination({
      action: 'nameplate_create',
      context: {},
    })).toEqual({ kind: 'fallback' });
  });
});
