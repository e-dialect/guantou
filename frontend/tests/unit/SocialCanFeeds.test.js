import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import SocialCanFeeds from '@/components/SocialCanFeeds.vue';

describe('SocialCanFeeds', () => {
  it('loads each tab once and keeps its list state isolated', async () => {
    const fetcher = vi.fn(async ({ feed }) => ({
      results: [{ id: feed === 'dialect' ? 1 : 2 }],
      next: null,
    }));
    const wrapper = mount(SocialCanFeeds, {
      props: { fetcher },
      global: {
        stubs: {
          CanCard: {
            props: ['can'],
            template: '<div class="can-card">{{ can.id }}</div>',
          },
          EmptyState: true,
          'uni-load-more': true,
          'scroll-view': { template: '<div><slot /></div>' },
        },
      },
    });
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith({ feed: 'dialect', page: 1 });
    wrapper.vm.activate('following');
    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith({ feed: 'following', page: 1 });
    expect(wrapper.vm.$refs.feedLists[0].items.map((item) => item.id)).toEqual([1]);
    expect(wrapper.vm.$refs.feedLists[1].items.map((item) => item.id)).toEqual([2]);

    wrapper.vm.activate('dialect');
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
