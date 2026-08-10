import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  actionLabel: vi.fn((action) => ({ record_can: '录一罐' }[action] || action)),
  peekInterceptIntent: vi.fn(),
}));

vi.mock('@/services/authJourney', () => ({
  cancelLoginToSearch: vi.fn(),
}));

vi.mock('@/services/login', () => ({
  mpLogin: vi.fn(),
  normalLogin: vi.fn(),
}));

import { cancelLoginToSearch } from '@/services/authJourney';
import { peekInterceptIntent } from '@/services/authGuard';

globalThis.getApp = vi.fn(() => ({
  globalData: {
    CustomBar: 64,
    StatusBar: 24,
  },
}));

const { default: LoginPage } = await import('@/pages/login/login.vue');

function mountLogin() {
  const wrapper = mount(LoginPage, {
    global: {
      stubs: {
        CuCustom: true,
        'cu-custom': true,
      },
    },
  });
  wrapper.vm.$options.onLoad.call(wrapper.vm);
  return wrapper;
}

describe('login page intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains the intercepted action and lets the guest return to search', async () => {
    peekInterceptIntent.mockReturnValue({
      action: 'record_can',
      context: { page: 'can_create' },
    });
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('你刚才想录一罐');
    await wrapper.find('.browse-first').trigger('tap');
    expect(cancelLoginToSearch).toHaveBeenCalledTimes(1);
  });

  it('uses distinct copy for voluntary login', async () => {
    peekInterceptIntent.mockReturnValue({
      action: 'open_mine',
      voluntary: true,
    });
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('验证身份后返回「我的」');
  });
});
