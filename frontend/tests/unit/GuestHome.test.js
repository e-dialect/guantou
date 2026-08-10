import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/pages/index.vue';

function mountHome(token = '') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    navigateTo: vi.fn(),
  };
  globalThis.getApp = vi.fn(() => ({
    globalData: {
      userInfo: token ? {
        primary_dialect: { name: '四川话', qualified_code: '西南官话.四川' },
      } : {},
    },
  }));
  const wrapper = mount(HomePage, {
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
        SocialCanFeeds: {
          template: '<div class="social-feeds">同方言 关注 推荐</div>',
        },
      },
    },
  });
  wrapper.vm.$options.onShow.call(wrapper.vm);
  return wrapper;
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

  it('shows isolated social feed tabs for signed-in users', () => {
    const wrapper = mountHome('token-value');

    expect(wrapper.text()).not.toContain('不登录也能查、能听');
    expect(wrapper.text()).toContain('主方言 · 西南官话.四川');
    expect(wrapper.text()).toContain('同方言 关注 推荐');
    expect(wrapper.text()).toContain('集盒');
    expect(wrapper.text()).toContain('图鉴');
    expect(wrapper.text()).toContain('我的');
    expect(wrapper.find('.can-list').exists()).toBe(false);
  });
});
