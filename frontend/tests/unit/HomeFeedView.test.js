import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/homeFeed', () => ({
  getTodayCan: vi.fn(),
  listHomeFeed: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  isLoggedIn: vi.fn(() => true),
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

vi.mock('@/utils/audio', () => ({
  preload: vi.fn(),
  stopAudio: vi.fn(),
}));

import HomeFeed from '@/components/home/HomeFeed.vue';
import { getTodayCan, listHomeFeed } from '@/services/homeFeed';
import { isLoggedIn, requireAuth } from '@/services/authGuard';
import { toLoginPage } from '@/routers/login';

function setupEnv({ userInfo = null } = {}) {
  globalThis.uni = {
    getStorageSync: vi.fn(() => ''),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
  globalThis.getCurrentPages = vi.fn(() => []);
  globalThis.getApp = vi.fn(() => ({ globalData: { userInfo } }));
}

function mountFeed(tab) {
  return mount(HomeFeed, {
    props: { tab },
    global: {
      stubs: {
        CanStageCard: true,
        HomeActionRail: true,
      },
    },
  });
}

describe('HomeFeed five states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoggedIn.mockReturnValue(true);
    requireAuth.mockReturnValue(true);
    setupEnv();
  });

  it('shows the error state on load failure and recovers on retry', async () => {
    listHomeFeed
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        results: [{ id: 1, audio_url: 'https://example.test/a.mp3' }],
        next: null,
      });

    const wrapper = mountFeed('recommended');
    await flushPromises();

    expect(wrapper.find('.home-feed__error').exists()).toBe(true);
    expect(wrapper.text()).toContain('内容加载失败');

    await wrapper.find('.home-feed__error-retry').trigger('tap');
    await flushPromises();

    expect(wrapper.find('.home-feed__error').exists()).toBe(false);
    expect(wrapper.find('.home-feed__swiper').exists()).toBe(true);
    expect(listHomeFeed).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state copy and action when there are no results', async () => {
    listHomeFeed.mockResolvedValue({ results: [], next: null });

    const wrapper = mountFeed('recommended');
    await flushPromises();

    expect(wrapper.find('.home-feed__empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('这里还没有罐头');

    await wrapper.find('.home-feed__empty-action').trigger('tap');

    expect(requireAuth).toHaveBeenCalledWith('record_can', { page: 'home_feed' });
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/cans/create' });
  });

  it('shows a login guidance for guests on the following tab', async () => {
    isLoggedIn.mockReturnValue(false);
    listHomeFeed.mockResolvedValue({ results: [], next: null });

    const wrapper = mountFeed('following');
    await flushPromises();

    expect(wrapper.find('.home-feed__guidance').exists()).toBe(true);
    expect(wrapper.text()).toContain('登录后看关注流');
    expect(wrapper.find('.home-feed__swiper').exists()).toBe(false);

    await wrapper.find('.home-feed__guidance-action').trigger('tap');

    expect(toLoginPage).toHaveBeenCalled();
  });

  it('shows a dialect picker guidance on the dialect tab without a primary dialect', async () => {
    setupEnv({ userInfo: {} });
    listHomeFeed.mockResolvedValue({ results: [], next: null });

    const wrapper = mountFeed('dialect');
    await flushPromises();

    expect(wrapper.find('.home-feed__guidance').exists()).toBe(true);
    expect(wrapper.text()).toContain('先选一个主方言');

    await wrapper.find('.home-feed__guidance-action').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/users/onboarding' });
  });

  it('renders the skeleton while the first page is loading', async () => {
    listHomeFeed.mockReturnValue(new Promise(() => {}));

    const wrapper = mountFeed('recommended');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.home-feed__skeleton').exists()).toBe(true);
    expect(wrapper.find('.home-feed__swiper').exists()).toBe(false);
  });

  it('loads the today tab through getTodayCan', async () => {
    getTodayCan.mockResolvedValue({ id: 8, audio_url: 'https://example.test/t.mp3' });

    const wrapper = mountFeed('today');
    await flushPromises();

    expect(getTodayCan).toHaveBeenCalled();
    expect(wrapper.find('.home-feed__swiper').exists()).toBe(true);
  });

  it('shows the load-more spinner while fetching the next page, then hides it', async () => {
    listHomeFeed
      .mockResolvedValueOnce({
        results: [
          { id: 1, audio_url: 'https://example.test/a.mp3' },
          { id: 2, audio_url: 'https://example.test/b.mp3' },
          { id: 3, audio_url: 'https://example.test/c.mp3' },
          { id: 4, audio_url: 'https://example.test/d.mp3' },
        ],
        next: 'https://example.test/api?page=2',
      });
    let resolveMore;
    listHomeFeed.mockImplementationOnce(() => new Promise((resolve) => {
      resolveMore = resolve;
    }));

    const wrapper = mountFeed('recommended');
    await flushPromises();
    expect(wrapper.find('.home-feed__load-more').exists()).toBe(false);

    wrapper.vm.loadMore();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.home-feed__load-more').exists()).toBe(true);
    expect(wrapper.find('.home-feed__spinner').exists()).toBe(true);

    resolveMore({ results: [], next: null });
    await flushPromises();
    expect(wrapper.find('.home-feed__load-more').exists()).toBe(false);
  });

  it('面板打开时锁定 swiper 而非销毁子树（保留操作栏状态）', async () => {
    listHomeFeed.mockResolvedValue({
      results: [{ id: 1, audio_url: 'https://example.test/a.mp3' }],
      next: null,
    });

    const wrapper = mount(HomeFeed, {
      props: { tab: 'recommended', swipeDisabled: true },
      global: {
        stubs: {
          CanStageCard: true,
          HomeActionRail: true,
        },
      },
    });
    await flushPromises();

    const swiper = wrapper.find('.home-feed__swiper');
    expect(swiper.exists()).toBe(true);
    expect(swiper.classes()).toContain('home-feed__swiper--locked');

    // 解锁后同一 swiper 仍在、锁定类移除，全程未重挂载子树
    await wrapper.setProps({ swipeDisabled: false });
    expect(wrapper.find('.home-feed__swiper').exists()).toBe(true);
    expect(wrapper.find('.home-feed__swiper').classes()).not.toContain('home-feed__swiper--locked');
  });
});
