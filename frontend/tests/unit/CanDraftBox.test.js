import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/canDrafts', () => ({
  listCanDrafts: vi.fn(),
  removeCanDraft: vi.fn(),
}));

import CanDrafts from '@/pages/cans/drafts.vue';
import { listCanDrafts, removeCanDraft } from '@/services/canDrafts';

const sampleDraft = {
  id: 'draft moon/1',
  mode: 'flavor',
  targetFlavor: { id: 12, name: '月亮' },
  dialectName: '游洋话',
  form: { concept_text: '月亮', dialect: 1 },
  label: {},
  audio: { path: '/tmp/moon.mp3' },
  createdAt: new Date(2026, 7, 6, 8, 9).getTime(),
  updatedAt: new Date(2026, 7, 6, 10, 11).getTime(),
};

function mountDrafts() {
  return mount(CanDrafts, {
    global: {
      stubs: {
        EmptyState: {
          props: ['title', 'description', 'actionText'],
          emits: ['action'],
          template: '<button class="empty-state" @tap="$emit(\'action\')">{{ title }}</button>',
        },
        PageShell: {
          props: ['title'],
          template: '<main><h1>{{ title }}</h1><slot /></main>',
        },
      },
    },
  });
}

describe('can draft box', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCanDrafts.mockReturnValue([sampleDraft]);
    globalThis.uni = {
      navigateTo: vi.fn(),
      showModal: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('lists drafts and opens one for editing', async () => {
    const wrapper = mountDrafts();
    wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('为「月亮」补录音');
    expect(wrapper.text()).toContain('游洋话 · 已保留录音');

    await wrapper.find('.continue-button').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?draft=draft%20moon%2F1',
    });
  });

  it('deletes a confirmed draft and refreshes the list', async () => {
    listCanDrafts
      .mockReturnValueOnce([sampleDraft])
      .mockReturnValueOnce([]);
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    const wrapper = mountDrafts();
    wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    await wrapper.find('.delete-button').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(removeCanDraft).toHaveBeenCalledWith(sampleDraft.id);
    expect(wrapper.vm.drafts).toEqual([]);
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '草稿已删除',
      icon: 'success',
    });
  });

  it('offers a new can action when the draft box is empty', async () => {
    listCanDrafts.mockReturnValue([]);
    const wrapper = mountDrafts();
    wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    await wrapper.find('.empty-state').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/cans/create' });
  });
});
