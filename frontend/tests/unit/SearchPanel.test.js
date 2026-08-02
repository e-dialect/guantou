import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchPanel from '@/components/SearchPanel.vue';

function mountSearchPanel(props = {}) {
  return mount(SearchPanel, {
    props: {
      modelValue: '',
      hotTags: ['月亮', '行'],
      historyList: ['膝盖'],
      suggestions: [],
      results: { flavors: [], packages: [], cans: [] },
      ...props,
    },
    global: {
      stubs: {
        CanCard: true,
        EmptyState: true,
        EntityCard: {
          props: ['item', 'title'],
          emits: ['open'],
          template: '<button class="entity-card" @tap="$emit(\'open\', item)">{{ title }}</button>',
        },
        ResultSection: {
          props: ['title', 'items'],
          template: '<section><h2>{{ title }}</h2><slot /></section>',
        },
        'scroll-view': {
          template: '<div><slot /></div>',
        },
      },
    },
  });
}

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces suggestions for 300ms', async () => {
    const wrapper = mountSearchPanel();

    await wrapper.find('input').setValue('moon');
    vi.advanceTimersByTime(299);
    expect(wrapper.emitted('suggest')).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(wrapper.emitted('suggest')[0]).toEqual(['moon']);
  });

  it('clicks hot tags and history entries into searches', async () => {
    const wrapper = mountSearchPanel();
    const tags = wrapper.findAll('.tag');

    await tags[0].trigger('tap');
    await tags[2].trigger('tap');

    expect(wrapper.emitted('pick-hot')[0]).toEqual(['月亮']);
    expect(wrapper.emitted('pick-history')[0]).toEqual(['膝盖']);
    expect(wrapper.emitted('search')).toEqual([['月亮'], ['膝盖']]);
  });

  it('emits grouped result navigation events', async () => {
    const wrapper = mountSearchPanel({
      hasSearched: true,
      results: {
        flavors: [{ id: 1, name: '月亮', definition: '天体', variants: [], package_links: [] }],
        packages: [],
        cans: [],
      },
    });

    await wrapper.find('.entity-card').trigger('tap');

    expect(wrapper.emitted('open')[0][0]).toMatchObject({
      id: 1,
      scope: 'flavors',
    });
  });
});
