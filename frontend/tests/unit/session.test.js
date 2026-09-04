import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hydrateAppSessionFromStorage,
  resolveSessionUserId,
} from '@/services/session';

describe('session hydration', () => {
  let app;

  beforeEach(() => {
    app = { globalData: { id: null } };
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
    };
    globalThis.getApp = vi.fn(() => app);
  });

  it('uses a stored token and id when App.globalData has not hydrated yet', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === 'token') return 'token';
      if (key === 'id') return 7;
      return '';
    });

    expect(resolveSessionUserId()).toBe(7);
    expect(app.globalData.id).toBe(7);
  });

  it('does not treat a stored id without a token as a session', () => {
    uni.getStorageSync.mockImplementation((key) => (key === 'id' ? 7 : ''));
    expect(resolveSessionUserId()).toBe('');
    expect(getApp().globalData.id).toBe(null);
  });

  it('hydrates App.globalData from storage on launch', () => {
    uni.getStorageSync.mockImplementation((key) => {
      if (key === 'token') return 'token';
      if (key === 'id') return 7;
      return '';
    });
    const launchApp = { globalData: { id: null } };
    globalThis.getApp = vi.fn(() => launchApp);
    hydrateAppSessionFromStorage();
    expect(launchApp.globalData.id).toBe(7);
  });
});
