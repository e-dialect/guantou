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

  it('renders four single-character visual labels with complete accessible names', () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'listen' } });

    expect(wrapper.findAll('.home-tab-bar__item')).toHaveLength(4);
    expect(wrapper.find('[aria-label="听乡音"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="查找词条"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="录制乡音"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="我的账户"]').exists()).toBe(true);
  });

  it('routes search and mine to their primary pages', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'listen' } });

    await wrapper.find('[aria-label="查找词条"]').trigger('tap');
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/search',
    }));

    await wrapper.find('[aria-label="我的账户"]').trigger('tap');
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/users/me',
    }));
  });

  it('does not re-navigate when home is already active', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'listen' } });

    await wrapper.find('[aria-label="听乡音"]').trigger('tap');

    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it('navigates home when active elsewhere', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'search' } });

    await wrapper.find('[aria-label="听乡音"]').trigger('tap');

    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index',
    }));
  });

  it('requires recording auth before opening the V2 create page', async () => {
    setupUni('');
    const wrapper = mount(HomeTabBar, { props: { active: 'listen' } });

    await wrapper.find('[aria-label="录制乡音"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(uni.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/recordings/create',
    }));
  });

  it('opens the V2 recording page for a signed-in contributor', async () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'listen' } });

    await wrapper.find('[aria-label="录制乡音"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/recordings/create' });
  });
});
