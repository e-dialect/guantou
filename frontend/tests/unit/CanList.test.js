import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CanList from '@/components/CanList.vue';

function mountCanList(props) {
  return mount(CanList, {
    props,
    global: {
      stubs: {
        CanCard: {
          props: ['can'],
          emits: ['open'],
          template: '<div class="can-card" @tap="$emit(\'open\', can.id)">{{ can.id }}</div>',
        },
        EmptyState: {
          props: ['title', 'description', 'actionText'],
          emits: ['action'],
          template: '<button class="empty-state" @tap="$emit(\'action\')">{{ title }}</button>',
        },
        'uni-load-more': true,
        'scroll-view': {
          template: '<div><slot /></div>',
        },
      },
    },
  });
}

describe('CanList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the first page and emits card clicks', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      results: [{ id: 1 }],
      next: null,
    });
    const wrapper = mountCanList({ fetcher });

    await flushPromises();
    await wrapper.find('.can-card').trigger('tap');

    expect(fetcher).toHaveBeenCalledWith({ page: 1 });
    expect(wrapper.emitted('open')[0]).toEqual([1]);
  });

  it('loads the next page when more data exists', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ results: [{ id: 1 }], next: 'next' })
      .mockResolvedValueOnce({ results: [{ id: 2 }], next: null });
    const wrapper = mountCanList({ fetcher });

    await flushPromises();
    await wrapper.vm.loadMore();

    expect(wrapper.vm.items.map((item) => item.id)).toEqual([1, 2]);
    expect(fetcher).toHaveBeenLastCalledWith({ page: 2 });
  });

  it('shows empty action when the first page has no cans', async () => {
    const fetcher = vi.fn().mockResolvedValue({ results: [], next: null });
    const wrapper = mountCanList({
      fetcher,
      emptyTitle: '还没有罐头',
      emptyActionText: '装一罐',
    });

    await flushPromises();
    await wrapper.find('.empty-state').trigger('tap');

    expect(wrapper.text()).toContain('还没有罐头');
    expect(wrapper.emitted('empty-action')).toHaveLength(1);
  });
});
