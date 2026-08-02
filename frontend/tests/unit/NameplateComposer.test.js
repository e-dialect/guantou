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

  it('trims payload text before submit', () => {
    expect(normalizeNameplateDraft({
      text_content: ' 行 ',
      definition: ' 走路 ',
      source_citation: ' elder ',
    })).toEqual({
      text_content: '行',
      definition: '走路',
      source_citation: 'elder',
    });
  });

  it('blocks empty nameplate text', async () => {
    const wrapper = mount(NameplateComposer);

    await wrapper.find('button').trigger('tap');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '请填写铭牌文字',
      icon: 'none',
    });
  });

  it('emits a valid nameplate payload', async () => {
    const wrapper = mount(NameplateComposer);
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('月光');
    await wrapper.find('textarea').setValue('月亮');
    await inputs[1].setValue('长辈确认');
    await wrapper.find('button').trigger('tap');

    expect(wrapper.emitted('submit')[0][0]).toEqual({
      text_content: '月光',
      definition: '月亮',
      source_citation: '长辈确认',
    });
  });
});
