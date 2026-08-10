import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/guantou', () => ({ getCan: vi.fn() }));
vi.mock('@/services/canSocial', () => ({
  createCanPost: vi.fn(),
  getCanPost: vi.fn(),
}));
vi.mock('@/utils/audio', () => ({ playAudio: vi.fn() }));

import { requireAuth } from '@/services/authGuard';
import { createCanPost } from '@/services/canSocial';
import { startUseSame, useSameUrl } from '@/services/canPostJourney';
import ComposePage from '@/pages/posts/compose.vue';

describe('Can-first post flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('keeps the source can id in the login and navigation journey', () => {
    expect(useSameUrl(19)).toBe('/pages/posts/compose?can_id=19');

    expect(startUseSame(19, { page: 'can_detail' })).toBe(true);
    expect(requireAuth).toHaveBeenCalledWith('use_same', {
      page: 'can_detail',
      canId: 19,
      postId: undefined,
    });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/posts/compose?can_id=19',
    });
  });

  it('publishes an optional caption but always includes the source can', async () => {
    createCanPost.mockResolvedValue({ id: 41 });
    const page = {
      ...ComposePage.data(),
      ...ComposePage.methods,
      can: { id: 19 },
      canId: 19,
      text: ' 我家也这样说 ',
      visibility: 'public',
    };

    await page.publish();

    expect(createCanPost).toHaveBeenCalledWith(19, ' 我家也这样说 ', 'public');
    expect(uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/posts/details?id=41',
    });
  });
});
