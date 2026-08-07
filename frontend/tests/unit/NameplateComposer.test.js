import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NameplateComposer, {
  normalizeNameplateDraft,
} from '@/components/NameplateComposer.vue';

describe('NameplateComposer', () => {
  beforeEach(() => {
    global.uni = {
      showToast: vi.fn(),
    };
  });

  function mountComposer() {
    return mount(NameplateComposer, {
      global: {
        stubs: {
          picker: { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('trims payload text before submit', () => {
    expect(normalizeNameplateDraft({
      text_content: ' 行 ',
      definition: ' 走路 ',
      pronunciation_text: ' hiŋ2 ',
      source: { type: 'oral', attributed_to: ' elder ' },
    })).toEqual({
      text_content: '行',
      definition: '走路',
      pronunciation_text: 'hiŋ2',
      source: {
        type: 'oral',
        title: '',
        attributed_to: 'elder',
        locator: '',
        note: '',
      },
    });
  });

  it('blocks empty nameplate text', async () => {
    const wrapper = mountComposer();

    await wrapper.find('button').trigger('tap');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '请填写原样写法或读音',
      icon: 'none',
    });
  });

  it('emits a valid nameplate payload', async () => {
    const wrapper = mountComposer();
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('月光');
    await wrapper.find('textarea').setValue('月亮');
    await inputs[1].setValue('ŋou');
    await inputs[2].setValue('祖母');
    await wrapper.find('button').trigger('tap');

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      text_content: '月光',
      definition: '月亮',
      pronunciation_text: 'ŋou',
      source: {
        type: 'creator',
        title: '',
        attributed_to: '祖母',
        locator: '',
        note: '',
      },
    });
  });
});
