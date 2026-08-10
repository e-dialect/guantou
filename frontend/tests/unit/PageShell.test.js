import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PageShell from '@/components/PageShell.vue';

describe('PageShell', () => {
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
});
