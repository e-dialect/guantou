import { mount } from '@vue/test-utils';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Vue test environment', () => {
  it('provides a quiet structural stub for UniApp scroll views', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mount({
      template: '<scroll-view class="archive-scroll"><span>内容</span></scroll-view>',
    });

    expect(wrapper.get('[data-uni-test-element="scroll-view"]').classes()).toContain('archive-scroll');
    expect(wrapper.text()).toContain('内容');
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets behavior tests replace the default structural stub', async () => {
    const onScroll = vi.fn();
    const wrapper = mount({
      methods: { onScroll },
      template: '<scroll-view @scroll="onScroll" />',
    }, {
      global: {
        stubs: {
          'scroll-view': {
            template: '<section data-local-scroll />',
          },
        },
      },
    });

    await wrapper.get('[data-local-scroll]').trigger('scroll');

    expect(onScroll).toHaveBeenCalledOnce();
  });

  it('continues to report unknown business components', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount({ template: '<unknown-business-widget />' });

    expect(warn.mock.calls.flat().join(' ')).toContain(
      'Failed to resolve component: unknown-business-widget',
    );
  });
});
