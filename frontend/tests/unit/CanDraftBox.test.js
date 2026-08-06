import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/canDrafts', () => ({
  listCanDraftsWithAudioStatus: vi.fn(),
  removeCanDraft: vi.fn(),
}));

import CanDrafts from '@/pages/cans/drafts.vue';
import { listCanDraftsWithAudioStatus, removeCanDraft } from '@/services/canDrafts';

const sampleDraft = {
  id: 'draft moon/1',
  mode: 'flavor',
  targetFlavor: { id: 12, name: '月亮' },
  dialectName: '游洋话',
  form: { concept_text: '月亮', dialect: 1 },
  label: {},
  audio: { persisted: true, available: true },
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
    listCanDraftsWithAudioStatus.mockResolvedValue([sampleDraft]);
    removeCanDraft.mockResolvedValue();
    globalThis.uni = {
      navigateTo: vi.fn(),
      showModal: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('lists drafts and opens one for editing', async () => {
    const wrapper = mountDrafts();
    await wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('为「月亮」补录音');
    expect(wrapper.text()).toContain('游洋话 · 已保存录音');

    await wrapper.find('.continue-button').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?draft=draft%20moon%2F1',
    });
  });

  it('deletes a confirmed draft and refreshes the list', async () => {
    listCanDraftsWithAudioStatus
      .mockResolvedValueOnce([sampleDraft])
      .mockResolvedValueOnce([]);
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    const wrapper = mountDrafts();
    await wrapper.vm.loadDrafts();
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
    listCanDraftsWithAudioStatus.mockResolvedValue([]);
    const wrapper = mountDrafts();
    await wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    await wrapper.find('.empty-state').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/cans/create' });
  });

  it('shows when a persisted recording is no longer available', async () => {
    listCanDraftsWithAudioStatus.mockResolvedValue([{
      ...sampleDraft,
      audio: { persisted: true, available: false },
    }]);
    const wrapper = mountDrafts();

    await wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('录音已失效，请重录');
  });

  it('reports a local storage failure when deleting a draft', async () => {
    removeCanDraft.mockRejectedValueOnce(new Error('storage full'));
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    const wrapper = mountDrafts();
    await wrapper.vm.loadDrafts();
    await wrapper.vm.$nextTick();

    await wrapper.find('.delete-button').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(uni.showToast).toHaveBeenCalledWith({
      title: '草稿删除失败，请稍后重试',
      icon: 'none',
    });
  });
});
