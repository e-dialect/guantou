import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/entryRecording', () => ({
  listRecordings: vi.fn(),
  pageResults: vi.fn((response) => response.results || response || []),
}));

vi.mock('@/utils/request', () => ({
  default: {
    put: vi.fn(),
  },
}));

import { listRecordings } from '@/services/entryRecording';
import {
  ensureDialectOnboarding,
  loadDialectSample,
  needsDialectOnboarding,
  saveDialectProfile,
} from '@/services/dialectOnboarding';
import request from '@/utils/request';

describe('dialect onboarding service', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = { globalData: { userInfo: {}, id: null } };
    globalThis.getApp = vi.fn(() => app);
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/index' }]);
    globalThis.uni = {
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      setStorageSync: vi.fn(),
    };
  });

  it('uses primary_dialect as the single source of truth', () => {
    expect(needsDialectOnboarding(null)).toBe(false);
    expect(needsDialectOnboarding({ primary_dialect: null })).toBe(true);
    expect(needsDialectOnboarding({ primary_dialect: { id: 3 } })).toBe(false);
  });

  it('routes a signed-in incomplete profile to the missing-dialect flow', () => {
    expect(ensureDialectOnboarding({ primary_dialect: null }, 'missing_dialect')).toBe(true);
    expect(uni.reLaunch).toHaveBeenCalledWith({
      url: '/pages/users/onboarding?reason=missing_dialect',
    });
  });

  it('loads one real public recording from the selected dialect subtree', async () => {
    listRecordings.mockResolvedValue({ results: [{ id: 8, audio_url: 'voice.mp3' }] });

    await expect(loadDialectSample(4)).resolves.toMatchObject({ id: 8 });
    expect(listRecordings).toHaveBeenCalledWith({
      dialect_id: 4,
      dialect_scope: 'subtree',
      page: 1,
      page_size: 1,
    });
  });

  it('persists nickname and primary dialect through the existing profile API', async () => {
    request.put.mockResolvedValue({
      token: 'new-token',
      user: { id: 7, nickname: '川娃', primary_dialect: { id: 4 } },
    });

    const user = await saveDialectProfile(7, {
      nickname: ' 川娃 ',
      primaryDialectId: 4,
    });

    expect(request.put).toHaveBeenCalledWith('/users/7', {
      user: { nickname: '川娃', primary_dialect_id: 4 },
    });
    expect(uni.setStorageSync).toHaveBeenCalledWith('token', 'new-token');
    expect(app.globalData.userInfo).toEqual(user);
  });
});
