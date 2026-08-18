import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeTabBar from '@/components/home/HomeTabBar.vue';

function setupUni(token = 'token-value') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    navigateTo: vi.fn(),
    reLaunch: vi.fn(),
    showToast: vi.fn(),
  };
  globalThis.getCurrentPages = vi.fn(() => []);
}

describe('HomeTabBar routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUni();
  });

  it('renders five slots including the raised 装罐 key', () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    expect(wrapper.text()).toContain('罐头');
    expect(wrapper.text()).toContain('图鉴');
    expect(wrapper.text()).toContain('装罐');
    expect(wrapper.text()).toContain('集盒');
    expect(wrapper.text()).toContain('我的');
    expect(wrapper.find('.home-tab-bar__create').exists()).toBe(true);
  });

  it('routes atlas / box / mine to their pages', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    await wrapper.find('[aria-label="图鉴"]').trigger('tap');
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/flavors/index',
    }));

    await wrapper.find('[aria-label="集盒"]').trigger('tap');
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/shelves/index',
    }));

    await wrapper.find('[aria-label="我的"]').trigger('tap');
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/users/me',
    }));
  });

  it('does not re-navigate when home is already active', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    await wrapper.find('[aria-label="罐头"]').trigger('tap');

    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it('navigates home when active elsewhere', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'atlas' } });

    await wrapper.find('[aria-label="罐头"]').trigger('tap');

    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index',
    }));
  });

  it('requires record_can auth before opening the create page', async () => {
    setupUni('');
    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    await wrapper.find('[aria-label="装罐"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(uni.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/create',
    }));
  });
});
