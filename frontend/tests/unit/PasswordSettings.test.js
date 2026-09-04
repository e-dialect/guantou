import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    goBack: vi.fn(),
    goLogin: vi.fn(),
    goLoginForget: vi.fn(),
  };
});

vi.mock('@/utils/request', () => ({
  default: {
    put: vi.fn(),
  },
}));

vi.mock('@/services/user', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getUserInfo: vi.fn(async () => ({
      user: { id: 7, username: 'collector', has_password: true },
    })),
  };
});

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/theme', () => ({
  applyTheme: vi.fn(() => ({ preference: 'light', resolved: 'light' })),
  getThemePreference: vi.fn(() => 'light'),
}));

import { goBack, goLogin, goLoginForget } from '@/services/navigation';
import { notify, notifySuccess } from '@/services/feedback';
import request from '@/utils/request';

const app = {
  globalData: {
    id: 7,
  },
};
globalThis.getApp = vi.fn(() => app);

const { default: PasswordPage } = await import('@/pages/users/settings/password.vue');

const passwordPageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/users/settings/password.vue'),
  'utf8',
);

function mountForm() {
  return mount(PasswordPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        BaseForm: {
          name: 'BaseForm',
          props: ['data', 'rules'],
          template: '<div><slot /></div>',
          methods: { validate() { return Promise.resolve(true); } },
        },
      },
    },
  });
}

describe('password settings form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.id = 7;
    app.globalData.userInfo = { username: 'collector' };
    globalThis.uni = {
      showToast: vi.fn(),
      setStorageSync: vi.fn(),
    };
    request.put.mockResolvedValue({});
  });

  it('uses design-system primitives instead of native form controls', () => {
    expect(passwordPageSource).toContain('changeUserPassword');
    expect(passwordPageSource).toContain('goLoginForget');
    expect(passwordPageSource).toContain('has_password');
    expect(passwordPageSource).toContain('设置密码');
    expect(passwordPageSource).toContain('PageShell');
    expect(passwordPageSource).toContain('BaseForm');
    expect(passwordPageSource).toContain('BaseField');
    expect(passwordPageSource).toContain('BaseButton');
    expect(passwordPageSource).not.toMatch(/<form[\s>]/);
    expect(passwordPageSource).not.toMatch(/<input[\s>]/);
    expect(passwordPageSource).not.toMatch(/<button[\s>]/);
    expect(passwordPageSource).not.toContain('cu-form-group');
    expect(passwordPageSource).not.toContain('cu-btn');
    expect(passwordPageSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('requires all fields and matching confirmation before submit', async () => {
    const wrapper = mountForm();
    await wrapper.vm.savePassword();
    expect(wrapper.vm.oldError).toBe('请输入原密码');
    expect(request.put).not.toHaveBeenCalled();

    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'other-pass';
    await wrapper.vm.savePassword();
    expect(wrapper.vm.confirmError).toBe('两次密码不一样');
    expect(request.put).not.toHaveBeenCalled();
  });

  it('rejects a new password outside the 6 to 32 character rule', async () => {
    const wrapper = mountForm();
    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = '123';
    wrapper.vm.confirmPassword = '123';
    await wrapper.vm.savePassword();
    expect(wrapper.vm.newError).toBe('新密码长度为 6 到 32 个字符');
    expect(request.put).not.toHaveBeenCalled();
  });

  it('sends the existing password payload and returns after success', async () => {
    request.put.mockResolvedValueOnce({ token: 'fresh-token', user: { id: 7 } });
    const wrapper = mountForm();
    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'new-pass';
    await wrapper.vm.savePassword();
    await flushPromises();
    expect(request.put).toHaveBeenCalledWith(
      '/users/7/password',
      { oldpassword: 'old-pass', newpassword: 'new-pass' },
      true,
    );
    expect(uni.setStorageSync).toHaveBeenCalledWith('token', 'fresh-token');
    expect(notifySuccess).toHaveBeenCalledWith('修改成功');
    expect(goBack).toHaveBeenCalled();
  });

  it('maps field errors from data.oldpassword and data.newpassword', async () => {
    const wrapper = mountForm();
    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'new-pass';
    request.put.mockRejectedValueOnce({
      message: '请求参数校验失败',
      data: { oldpassword: { code: 'invalid', message: '原密码不正确' } },
    });
    await wrapper.vm.savePassword();
    await flushPromises();
    expect(wrapper.vm.oldError).toBe('原密码不正确');
    expect(wrapper.vm.newError).toBe('');
    expect(notify).toHaveBeenCalledWith({ title: '原密码不正确' });
    expect(goBack).not.toHaveBeenCalled();

    request.put.mockRejectedValueOnce({
      message: '请求参数校验失败',
      data: { newpassword: { code: 'invalid', message: '密码不符合规范异常' } },
    });
    await wrapper.vm.savePassword();
    await flushPromises();
    expect(wrapper.vm.newError).toBe('密码不符合规范异常');
  });

  it('places a wrong-password 401 on the original password field', async () => {
    const wrapper = mountForm();
    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'new-pass';
    request.put.mockRejectedValueOnce({
      statusCode: 401,
      message: '密码错误',
      data: {},
    });
    await wrapper.vm.savePassword();
    await flushPromises();
    expect(wrapper.vm.oldError).toBe('密码错误');
    expect(wrapper.vm.newError).toBe('');
    expect(notify).toHaveBeenCalledWith({ title: '密码错误' });
    expect(goLogin).not.toHaveBeenCalled();
  });

  it('ignores a second submit while the first request is in flight', async () => {
    let finishRequest;
    request.put.mockImplementationOnce(() => new Promise((settle) => {
      finishRequest = settle;
    }));
    const wrapper = mountForm();
    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'new-pass';
    const first = wrapper.vm.savePassword();
    await Promise.resolve();
    expect(wrapper.vm.saving).toBe(true);
    await wrapper.vm.savePassword();
    expect(request.put).toHaveBeenCalledTimes(1);
    finishRequest({});
    await first;
    await flushPromises();
    expect(wrapper.vm.saving).toBe(false);
  });

  it('toggles password visibility independently for each field', () => {
    const wrapper = mountForm();
    expect(wrapper.vm.oldVisible).toBe(false);
    wrapper.vm.toggleVisible('old');
    expect(wrapper.vm.oldVisible).toBe(true);
    expect(wrapper.vm.newVisible).toBe(false);

    wrapper.vm.saving = true;
    wrapper.vm.toggleVisible('new');
    expect(wrapper.vm.newVisible).toBe(false);
  });

  it('sends guests to login when the page shows', () => {
    app.globalData.id = '';
    const wrapper = mountForm();
    wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(goLogin).toHaveBeenCalled();
  });

  it('opens email recovery with the signed-in username', () => {
    app.globalData.userInfo = { username: 'collector' };
    const wrapper = mountForm();
    wrapper.vm.goForgetPassword();
    expect(goLoginForget).toHaveBeenCalledWith({ username: 'collector' });
  });

  it('lets a passwordless account set a password without the old field', async () => {
    request.put.mockResolvedValueOnce({ token: 'fresh-token', user: { id: 7, has_password: true } });
    const wrapper = mountForm();
    wrapper.vm.hasPassword = false;
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'new-pass';
    await wrapper.vm.savePassword();
    await flushPromises();
    expect(request.put).toHaveBeenCalledWith(
      '/users/7/password',
      { oldpassword: '', newpassword: 'new-pass' },
      true,
    );
    expect(wrapper.vm.oldError).toBe('');
  });
});
