import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  deleteCan: vi.fn(),
  listCans: vi.fn(),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));

import CanLibrary from '@/pages/cans/library.vue';
import { deleteCan } from '@/services/guantou';

const removeItem = vi.fn();

function mountLibrary() {
  return mount(CanLibrary, {
    global: {
      stubs: {
        CanDraftList: true,
        CanList: {
          name: 'CanList',
          methods: { removeItem },
          template: '<div class="can-list" />',
        },
        PageShell: { template: '<main><slot name="before" /><slot /></main>' },
        'scroll-view': { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('personal can library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCan.mockResolvedValue({});
    globalThis.uni = {
      navigateTo: vi.fn(),
      showModal: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('switches between recorded, liked, and draft collections', async () => {
    const wrapper = mountLibrary();
    expect(wrapper.vm.canQuery).toEqual({ mine: true });

    wrapper.vm.tab = 'liked';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.canQuery).toEqual({ liked: true });

    wrapper.vm.tab = 'drafts';
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'CanDraftList' }).exists()).toBe(true);
  });

  it('deletes an owned can only after confirmation and removes it locally', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    const wrapper = mountLibrary();

    wrapper.vm.confirmDelete({ id: 7, concept_text: '月亮' });
    await flushPromises();

    expect(deleteCan).toHaveBeenCalledWith(7);
    expect(removeItem).toHaveBeenCalledWith(7);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '已删除', icon: 'success' });
  });

  it('opens reuse mode with the source can', () => {
    const wrapper = mountLibrary();
    wrapper.vm.toReuse(9);
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?source_can=9',
    });
  });
});
