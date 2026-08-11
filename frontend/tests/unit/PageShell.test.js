import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PageShell from '@/components/PageShell.vue';

describe('PageShell', () => {
  beforeEach(() => {
    globalThis.uni = {
      $emit: vi.fn(),
      $off: vi.fn(),
      $on: vi.fn(),
      getStorageSync: vi.fn(() => 'light'),
      getSystemInfoSync: vi.fn(() => ({ theme: 'light' })),
      navigateBack: vi.fn(),
    };
  });

  it('keeps the title in the center grid column when back is hidden', () => {
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

    wrapper.vm.handleThemeChange({ preference: 'dark', resolved: 'dark' });
    await wrapper.vm.$nextTick();

    expect(wrapper.classes()).toContain('theme-dark');
    wrapper.unmount();
    expect(uni.$off).toHaveBeenCalled();
  });
});
