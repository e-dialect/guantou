import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(),
}));

vi.mock('@/services/following', () => ({
  followDialect: vi.fn(),
  followUser: vi.fn(),
  listFollowRecommendations: vi.fn(),
  unfollowDialect: vi.fn(),
}));

vi.mock('@/routers', () => ({
  toIndexPage: vi.fn(),
}));

import { toIndexPage } from '@/routers';
import {
  followDialect,
  followUser,
  listFollowRecommendations,
} from '@/services/following';
import { listAllDialects } from '@/services/guantou';

const app = {
  globalData: {
    userInfo: {
      id: 7,
      primary_dialect: { id: 3, name: '四川话', qualified_code: '西南官话.四川' },
      followed_dialects: [{ id: 3, name: '四川话' }],
    },
  },
};
globalThis.getApp = vi.fn(() => app);

const { default: RecommendFollowPage } = await import('@/pages/users/recommend-follow.vue');

function mountPage() {
  return mount(RecommendFollowPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        'scroll-view': { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('follow recommendations page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.userInfo.followed_dialects = [{ id: 3, name: '四川话' }];
    globalThis.uni = {
      reLaunch: vi.fn(),
      showToast: vi.fn(),
    };
    listAllDialects.mockResolvedValue([
      { id: 3, name: '四川话', qualified_code: '西南官话.四川', depth: 1 },
      { id: 4, name: '客家话', qualified_code: '客家话', depth: 0 },
    ]);
    listFollowRecommendations.mockResolvedValue({
      results: [{
        id: 12,
        username: 'real-author',
        nickname: '真实作者',
        primary_dialect: { id: 3, qualified_code: '西南官话.四川' },
        public_can_count: 2,
      }],
    });
    followDialect.mockResolvedValue({ following: true });
    followUser.mockResolvedValue({ following: true });
  });

  it('loads real same-dialect authors and saves selected follows', async () => {
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm);
    await flushPromises();

    expect(listFollowRecommendations).toHaveBeenCalledWith(3);
    expect(wrapper.text()).toContain('真实作者');

    wrapper.vm.toggleDialect(4);
    await wrapper.vm.save();

    expect(followDialect).toHaveBeenCalledWith(4);
    expect(followUser).toHaveBeenCalledWith(12);
    expect(toIndexPage).toHaveBeenCalledWith(true);
    expect(app.globalData.userInfo.followed_dialects.map((item) => item.id)).toEqual([3, 4]);
  });

  it('keeps the primary dialect when it is tapped and allows skipping', () => {
    const wrapper = mountPage();

    wrapper.vm.toggleDialect(3);
    expect(wrapper.vm.selectedDialectIds).toEqual([3]);

    wrapper.vm.skip();
    expect(toIndexPage).toHaveBeenCalledWith(true);
  });
});
