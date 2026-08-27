import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));
vi.mock('@/services/canSocial', () => ({
  likeCan: vi.fn(),
  unlikeCan: vi.fn(),
}));
vi.mock('@/services/following', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));
vi.mock('@/routers/user', () => ({
  toUserPage: vi.fn(),
}));
vi.mock('@/utils/shareCan', () => ({
  shareCanOnWeb: vi.fn(),
}));
vi.mock('@/services/commentSheet', () => ({
  openCommentSheet: vi.fn(),
}));

import HomeActionRail from '@/components/home/HomeActionRail.vue';
import { requireAuth } from '@/services/authGuard';
import { likeCan } from '@/services/canSocial';
import { followUser, unfollowUser } from '@/services/following';
import { openCommentSheet } from '@/services/commentSheet';

function setupUni(storage = {}) {
  globalThis.uni = {
    getStorageSync: vi.fn(
      (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : ''),
    ),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
}

function canFixture(overrides = {}) {
  return {
    id: 12,
    liked_by_me: false,
    like_count: 5,
    comment_count: 2,
    recorder_followed_by_me: false,
    recorder: { id: 99, avatar: '' },
    ...overrides,
  };
}

function mountRail(can) {
  return mount(HomeActionRail, { props: { can } });
}

describe('HomeActionRail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockReturnValue(true);
    setupUni();
  });

  describe('like', () => {
    it('likes optimistically, then adopts the server counts', async () => {
      let resolveLike;
      likeCan.mockImplementation(
        () => new Promise((resolve) => {
          resolveLike = resolve;
        }),
      );
      const wrapper = mountRail(canFixture());

      await wrapper.find('[aria-label="点赞"]').trigger('tap');

      // 乐观更新：请求返回前本地已 +1
      expect(wrapper.vm.liked).toBe(true);
      expect(wrapper.vm.likeCount).toBe(6);

      resolveLike({ liked: true, like_count: 20 });
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(likeCan).toHaveBeenCalledWith(12);
      expect(wrapper.vm.likeCount).toBe(20);
    });

    it('rolls back the like when the request fails', async () => {
      likeCan.mockRejectedValue(new Error('boom'));
      const wrapper = mountRail(canFixture());

      await wrapper.find('[aria-label="点赞"]').trigger('tap');
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.liked).toBe(false);
      expect(wrapper.vm.likeCount).toBe(5);
    });

    it('blocks guest likes via the auth guard', async () => {
      requireAuth.mockReturnValue(false);
      const wrapper = mountRail(canFixture());

      await wrapper.find('[aria-label="点赞"]').trigger('tap');
      await wrapper.vm.$nextTick();

      expect(requireAuth).toHaveBeenCalledWith('like', { page: 'home_feed', canId: 12 });
      expect(likeCan).not.toHaveBeenCalled();
      expect(wrapper.vm.likeCount).toBe(5);
    });
  });

  describe('comment', () => {
    it('opens the half-screen comment sheet without requiring auth', async () => {
      const wrapper = mountRail(canFixture());

      await wrapper.find('[aria-label="评论"]').trigger('tap');

      // 评论属于可浏览内容（见 #202），游客无需登录即可查看，故不再走 requireAuth。
      expect(requireAuth).not.toHaveBeenCalled();
      expect(openCommentSheet).toHaveBeenCalledWith({
        targetType: 'can',
        targetId: 12,
        theme: 'immersive',
      });
      expect(uni.navigateTo).not.toHaveBeenCalled();
    });
  });

  describe('share', () => {
    it('emits share with the can payload', async () => {
      const can = canFixture();
      const wrapper = mountRail(can);

      await wrapper.find('[aria-label="分享"]').trigger('tap');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('share')).toBeTruthy();
      expect(wrapper.emitted('share')[0][0]).toEqual(can);
    });
  });

  describe('follow', () => {
    it('initializes the follow state from the recorder_followed_by_me prop', async () => {
      const wrapper = mountRail(canFixture({ recorder_followed_by_me: true }));

      expect(wrapper.vm.following).toBe(true);
      expect(wrapper.find('.action-rail__follow').classes()).toContain(
        'action-rail__follow--done',
      );

      // 已关注态下点击执行取消关注
      unfollowUser.mockResolvedValue({});
      await wrapper.find('.action-rail__follow').trigger('tap');
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(unfollowUser).toHaveBeenCalledWith(99);
      expect(wrapper.vm.following).toBe(false);
    });

    it('follows optimistically when not yet following', async () => {
      followUser.mockResolvedValue({});
      const wrapper = mountRail(canFixture());

      await wrapper.find('.action-rail__follow').trigger('tap');
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      expect(followUser).toHaveBeenCalledWith(99);
      expect(wrapper.vm.following).toBe(true);
    });

    it('skips follow when the recorder is the current user', async () => {
      setupUni({ id: 99 });
      const wrapper = mountRail(canFixture());

      await wrapper.find('.action-rail__follow').trigger('tap');
      await wrapper.vm.$nextTick();

      expect(requireAuth).not.toHaveBeenCalledWith(
        'follow',
        expect.anything(),
      );
      expect(followUser).not.toHaveBeenCalled();
      expect(wrapper.vm.following).toBe(false);
    });
  });
});
