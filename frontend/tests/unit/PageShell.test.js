import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import FeedbackHost from '@/components/FeedbackHost.vue';

describe('PageShell', () => {
  beforeEach(() => {
    global.uni = {
      $emit: vi.fn(),
      $off: vi.fn(),
      $on: vi.fn(),
      getStorageSync: vi.fn(() => 'light'),
      setStorageSync: vi.fn(),
      getSystemInfoSync: vi.fn(() => ({ theme: 'light' })),
      navigateBack: vi.fn(),
    };
  });

  it('keeps the title in the centered grid column when back is hidden', () => {
    const wrapper = mount(PageShell, {
      props: {
        title: '乡声集盒',
        showBack: false,
      },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
      slots: { default: '<div>content</div>' },
    });

    const topbar = wrapper.find('.shell-topbar');
    expect(topbar.find('.shell-back').exists()).toBe(false);
    expect(topbar.find('.shell-back-placeholder').exists()).toBe(true);
    expect(topbar.find('.shell-title').text()).toBe('乡声集盒');
    expect(wrapper.findComponent(FeedbackHost).exists()).toBe(true);
    wrapper.unmount();
  });

  it('uses a named design-system circle for the back affordance', () => {
    const wrapper = mount(PageShell, {
      props: { title: '词条详情' },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });

    const back = wrapper.findAllComponents(BaseButton)
      .find((button) => button.props('ariaLabel') === '返回');
    expect(back?.props()).toMatchObject({
      size: 'small',
      variant: 'ghost',
      shape: 'circle',
    });
    expect(back?.text()).toBe('‹');
    wrapper.unmount();
  });

  it('uses the shared button contract for topbar actions', () => {
    const wrapper = mount(PageShell, {
      props: { title: '编辑', actionText: '保存' },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });
    const action = wrapper.findAllComponents(BaseButton)
      .find((button) => button.props('text') === '保存');
    expect(action.props('text')).toBe('保存');
    action.vm.$emit('click');
    expect(wrapper.emitted('action')).toHaveLength(1);
    wrapper.unmount();
  });

  it('applies a theme update without browser-only globals', async () => {
    uni.getStorageSync.mockReturnValue('light');
    uni.getSystemInfoSync.mockReturnValue({ theme: 'light' });
    const wrapper = mount(PageShell, {
      props: { title: '主题' },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });

    wrapper.vm.handleThemeChange({ preference: 'dark', resolved: 'dark', accent: 'tea' });
    await wrapper.vm.$nextTick();

    expect(wrapper.classes()).toContain('theme-dark');
    expect(wrapper.classes()).toContain('accent-tea');
    wrapper.unmount();
    expect(uni.$off).toHaveBeenCalled();
  });

  it('tints the top bar with the active accent tokens', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/PageShell.vue'), 'utf8');
    expect(source).toContain('--dress-nav-bar-background');
    expect(source).toContain('linear-gradient(90deg, var(--surface-color), var(--accent-subtle-color))');
    expect(source).toContain('var(--dress-nav-bar-border-color, var(--border-color))');
    expect(source).toContain('shell-grain');
    expect(source).toContain('var(--dress-grain-image, var(--grain-dot))');
  });

  it('skips stack back when interceptBack is set', async () => {
    global.getCurrentPages = () => [
      { route: 'pages/users/me' },
      { route: 'pages/users/theme-center' },
    ];
    uni.reLaunch = vi.fn();
    const wrapper = mount(PageShell, {
      props: {
        title: '主题中心',
        interceptBack: true,
      },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });
    const back = wrapper.findAllComponents(BaseButton)
      .find((button) => button.props('ariaLabel') === '返回');
    back.vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('back')).toHaveLength(1);
    expect(uni.navigateBack).not.toHaveBeenCalled();
    expect(uni.reLaunch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('forwards H5 native scrolling and preserves the scrolltolower contract', () => {
    const wrapper = mount(PageShell, {
      props: { title: '主题中心' },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });
    wrapper.vm.onH5Scroll({
      currentTarget: {
        scrollTop: 180,
        scrollHeight: 680,
        clientHeight: 500,
      },
    });
    expect(wrapper.emitted('scroll')[0][0]).toEqual({ scrollTop: 180 });
    expect(wrapper.emitted('scrolltolower')).toHaveLength(1);
    wrapper.unmount();
  });
});
