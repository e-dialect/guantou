import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseButton from '@/components/BaseButton.vue';
import ThemeLivePreview from '@/components/ThemeLivePreview.vue';
import { THEME_PREVIEW_SAMPLE } from '@/services/themeCenter';

const model = {
  shotClass: ['shot-default'],
  skipped: [],
  nativeLocked: false,
  sample: THEME_PREVIEW_SAMPLE,
  vars: {},
};

describe('ThemeLivePreview', () => {
  beforeEach(() => {
    global.uni = {
      $emit: vi.fn(),
      $on: vi.fn(),
      $off: vi.fn(),
      getStorageSync: vi.fn(() => ''),
    };
  });

  it('keeps a named design-system close action above the long preview', () => {
    const wrapper = mount(ThemeLivePreview, {
      props: {
        open: true,
        title: '装扮效果预览',
        model,
      },
    });
    const close = wrapper.findAllComponents(BaseButton)
      .find((button) => button.props('ariaLabel') === '关闭实时预览');

    expect(close?.props()).toMatchObject({
      size: 'small',
      variant: 'ghost',
    });
    close.vm.$emit('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
