import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

const { toLoginPage } = await import('@/routers/login');
const authGuard = await import('@/services/authGuard');

let storage;

function installUniMock(token = '') {
  storage = {};
  if (token) storage.token = token;
  global.uni = {
    getStorageSync: vi.fn((key) => storage[key] || ''),
    setStorageSync: vi.fn((key, value) => {
      storage[key] = value;
    }),
    removeStorageSync: vi.fn((key) => {
      delete storage[key];
    }),
    showToast: vi.fn(),
  };
}

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installUniMock();
  });

  it('allows unprotected actions without login', () => {
    expect(authGuard.requireAuth('read_can')).toBe(true);
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('stores intercept intent and redirects protected anonymous actions', () => {
    expect(authGuard.requireAuth('record_can', { page: 'test' })).toBe(false);

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '请先登录',
      icon: 'none',
    }));
    expect(toLoginPage).toHaveBeenCalledTimes(1);
    expect(authGuard.peekInterceptIntent()).toMatchObject({
      action: 'record_can',
      context: { page: 'test' },
    });
  });

  it('allows protected actions when logged in', () => {
    installUniMock('token-value');

    expect(authGuard.requireAuth('record_can')).toBe(true);
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('clears expired intercept intents', () => {
    authGuard.saveInterceptIntent({
      action: 'record_can',
      context: {},
      createdAt: Date.now() - (25 * 60 * 60 * 1000),
    });

    expect(authGuard.peekInterceptIntent()).toBeNull();
    expect(uni.removeStorageSync).toHaveBeenCalledWith('auth_intercept_intent');
  });
});
