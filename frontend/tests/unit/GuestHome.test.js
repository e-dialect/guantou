import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/pages/index.vue';

function mountHome(token = '') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    navigateTo: vi.fn(),
  };
  return mount(HomePage, {
    global: {
      stubs: {
        PageShell: {
          props: ['title', 'actionText'],
          template: '<main><slot /></main>',
        },
        SectionBlock: {
          props: ['title'],
          template: '<section><h2>{{ title }}</h2><slot /></section>',
        },
        CanList: {
          props: ['query'],
          template: '<div class="can-list" :data-query="JSON.stringify(query)" />',
        },
      },
    },
  });
}

describe('guest-first home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows public browsing guidance and requests visible cans for guests', () => {
    const wrapper = mountHome();

    expect(wrapper.text()).toContain('不登录也能查、能听');
    expect(wrapper.text()).toContain('公开乡音');
    expect(wrapper.find('.can-list').attributes('data-query')).toBe('{}');
  });

  it('keeps the contribution-focused home for signed-in users', () => {
    const wrapper = mountHome('token-value');

    expect(wrapper.text()).not.toContain('不登录也能查、能听');
    expect(wrapper.text()).toContain('待贴铭牌');
    expect(wrapper.find('.can-list').attributes('data-query')).toContain('needs_label');
  });
});
