import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({ getDiscovery: vi.fn() }));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));

import DiscoveryPage from '@/pages/discovery/index.vue';
import { requireAuth } from '@/services/authGuard';
import { getDiscovery } from '@/services/guantou';

const payload = {
  daily_flavor: { id: 3, name: '月亮', definition: '夜空中的天然卫星' },
  hot_cans: [{ id: 5, concept_text: '月亮' }],
  hot_flavors: [{ id: 3, name: '月亮', definition: '夜空中的天然卫星' }],
  topics: [{
    id: 7,
    title: '家乡怎样说月亮',
    prompt: '录下你家乡对月亮的说法',
    flavor: { id: 3, name: '月亮' },
    dialect: { id: 9, name: '莆仙话' },
  }],
};

function mountPage() {
  return mount(DiscoveryPage, {
    global: {
      stubs: {
        CanCard: { props: ['can'], template: '<div class="can-card">{{ can.id }}</div>' },
        PageShell: { template: '<main><slot /></main>' },
        SectionBlock: {
          props: ['title'],
          template: '<section><h2>{{ title }}</h2><slot /></section>',
        },
      },
    },
  });
}

describe('discovery page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDiscovery.mockResolvedValue(payload);
    requireAuth.mockReturnValue(true);
    globalThis.uni = { navigateTo: vi.fn() };
  });

  it('renders daily, hot, and challenge content from the aggregate endpoint', async () => {
    const wrapper = mountPage();
    await wrapper.vm.load();
    await flushPromises();

    expect(wrapper.text()).toContain('今日方言词');
    expect(wrapper.text()).toContain('热罐头');
    expect(wrapper.text()).toContain('家乡怎样说月亮');
  });

  it('starts a challenge with its flavor and dialect locked into can creation', () => {
    const wrapper = mountPage();
    wrapper.vm.joinTopic(payload.topics[0]);

    expect(requireAuth).toHaveBeenCalledWith('record_can', {
      page: 'discovery',
      challengeId: 7,
    });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?flavor=3&flavor_name=%E6%9C%88%E4%BA%AE&dialect=9',
    });
  });
});
