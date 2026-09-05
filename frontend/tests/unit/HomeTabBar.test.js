import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import HomeTabBar from '@/components/home/HomeTabBar.vue';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/home/HomeTabBar.vue'),
  'utf8',
);

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

  it.each(['listen', 'search', 'record', 'me'])(
    'exposes exactly one selected destination when %s is active',
    (active) => {
      const wrapper = mount(HomeTabBar, { props: { active } });
      const selected = wrapper.findAll('[data-nav-state="selected"]');

      expect(selected).toHaveLength(1);
      expect(selected[0].attributes('aria-current')).toBe('page');
      expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(1);
    },
  );

  it('keeps record as an action without presenting it as a second selection', () => {
    const wrapper = mount(HomeTabBar, { props: { active: 'search' } });
    const record = wrapper.get('[aria-label="录制乡音"]');

    expect(record.attributes('data-nav-state')).toBe('action');
    expect(record.attributes('aria-current')).toBeUndefined();
    expect(record.classes()).not.toContain('home-tab-bar__item--active');
  });

  it('consumes the complete tab-bar foreground contract with immersive fallbacks', () => {
    [
      '--dress-tab-bar-background',
      '--dress-tab-bar-color',
      '--dress-tab-bar-accent',
      '--dress-tab-bar-on-accent',
      '--dress-tab-bar-emphasis',
      '--dress-tab-bar-border-color',
    ].forEach((token) => expect(source).toContain(token));
    expect(source).not.toContain('border-top: 1rpx solid var(--immersive-border-color)');
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
