import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { goBack, goLogin } from '@/services/navigation';
import { notify, notifySuccess } from '@/services/feedback';
import request from '@/utils/request';

vi.mock('@/services/navigation', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    goBack: vi.fn(),
    goLogin: vi.fn(),
  };
});

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/theme', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    applyTheme: vi.fn(() => ({ preference: 'light', resolved: 'light' })),
    getThemePreference: vi.fn(() => 'light'),
  };
});

const app = {
  globalData: {
    id: 7,
  },
};
globalThis.getApp = vi.fn(() => app);

const { default: EmailPage } = await import('@/pages/users/settings/email.vue');

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/users/settings/email.vue'),
  'utf8',
);

function mountPage() {
  return mount(EmailPage, {
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

async function showPage() {
  const wrapper = mountPage();
  await wrapper.vm.$options.onShow.call(wrapper.vm);
  await flushPromises();
  return wrapper;
}

describe('email settings form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.id = 7;
    globalThis.uni = {
      showToast: vi.fn(),
    };
    request.get.mockResolvedValue({ user: { email: 'old@example.com' } });
    request.post.mockResolvedValue({});
    request.put.mockResolvedValue({ user: { email: 'new@example.com' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses design-system primitives instead of native form controls', () => {
    expect(source).toContain('getUserInfo');
    expect(source).toContain('changeUserEmail');
    expect(source).toContain('sendEmailCode');
    expect(source).toContain('PageShell');
    expect(source).toContain('BaseForm');
    expect(source).toContain('BaseField');
    expect(source).toContain('BaseButton');
    expect(source).not.toMatch(/<form[\s>]/);
    expect(source).not.toMatch(/<input[\s>]/);
    expect(source).not.toMatch(/<button[\s>]/);
    expect(source).not.toContain('cu-form-group');
    expect(source).not.toContain('cu-btn');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('requires a different email before sending a bind code', async () => {
    const wrapper = await showPage();
    await wrapper.vm.sendCode();
    expect(wrapper.vm.emailError).toBe('请输入新邮箱');
    expect(request.post).not.toHaveBeenCalled();

    wrapper.vm.newEmail = 'OLD@example.com';
    await wrapper.vm.sendCode();
    expect(wrapper.vm.emailError).toBe('请填写与当前邮箱不同的地址');
    expect(request.post).not.toHaveBeenCalled();
  });

  it('sends the bind-purpose payload and starts a resend countdown', async () => {
    vi.useFakeTimers();
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'new@example.com';
    request.post.mockResolvedValueOnce({ retry_after: 60 });
    await wrapper.vm.sendCode();
    await flushPromises();
    expect(request.post).toHaveBeenCalledWith(
      '/users/email-code',
      { email: 'new@example.com', purpose: 'bind' },
      true,
    );
    expect(notify).toHaveBeenCalledWith({ title: '验证码已发送' });
    expect(wrapper.vm.countdown).toBe(60);
    expect(wrapper.vm.newEmail).toBe('new@example.com');
    expect(wrapper.vm.demoCode).toBe('');

    await wrapper.vm.sendCode();
    expect(request.post).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(wrapper.vm.countdown).toBe(59);
    wrapper.vm.clearCountdown();
  });

  it('shows a demo code when the bind endpoint is in demo mode', async () => {
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'new@example.com';
    request.post.mockResolvedValueOnce({ retry_after: 60, demo_code: '654321' });
    await wrapper.vm.sendCode();
    await flushPromises();
    expect(wrapper.vm.demoCode).toBe('654321');
    expect(notify).toHaveBeenCalledWith({ title: '验证码已生成' });
  });

  it('maps an occupied mailbox onto the email field and keeps the draft', async () => {
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'taken@example.com';
    request.post.mockRejectedValueOnce({
      statusCode: 409,
      message: '该邮箱已被绑定',
      data: {},
    });
    await wrapper.vm.sendCode();
    await flushPromises();
    expect(wrapper.vm.emailError).toBe('该邮箱已被绑定');
    expect(wrapper.vm.newEmail).toBe('taken@example.com');
    expect(notify).toHaveBeenCalledWith({ title: '该邮箱已被绑定' });
  });

  it('throttles resend after a 429 without clearing the email', async () => {
    vi.useFakeTimers();
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'new@example.com';
    request.post.mockRejectedValueOnce({
      statusCode: 429,
      message: '验证码发送过于频繁',
      data: {},
    });
    await wrapper.vm.sendCode();
    await flushPromises();
    expect(wrapper.vm.countdown).toBe(60);
    expect(wrapper.vm.newEmail).toBe('new@example.com');
    wrapper.vm.clearCountdown();
  });

  it('requires email and code then saves the existing bind payload', async () => {
    const wrapper = await showPage();
    await wrapper.vm.setNewEmail();
    expect(wrapper.vm.emailError).toBe('请输入新邮箱');
    expect(request.put).not.toHaveBeenCalled();

    wrapper.vm.newEmail = 'new@example.com';
    wrapper.vm.code = '123456';
    await wrapper.vm.setNewEmail();
    await flushPromises();
    expect(request.put).toHaveBeenCalledWith(
      '/users/7/email',
      { email: 'new@example.com', code: '123456' },
      true,
    );
    expect(notifySuccess).toHaveBeenCalledWith('修改成功');
    expect(goBack).toHaveBeenCalled();
  });

  it('maps code errors and keeps recoverable input after a failed save', async () => {
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'new@example.com';
    wrapper.vm.code = '123456';
    request.put.mockRejectedValueOnce({
      message: '验证码错误',
      data: { code: { code: 'invalid', message: '验证码错误' } },
    });
    await wrapper.vm.setNewEmail();
    await flushPromises();
    expect(wrapper.vm.codeError).toBe('验证码错误');
    expect(wrapper.vm.newEmail).toBe('new@example.com');
    expect(wrapper.vm.code).toBe('123456');
    expect(notify).toHaveBeenCalledWith({ title: '验证码错误' });
    expect(goBack).not.toHaveBeenCalled();
  });

  it('ignores a second save while the first request is in flight', async () => {
    let finishRequest;
    request.put.mockImplementationOnce(() => new Promise((settle) => {
      finishRequest = settle;
    }));
    const wrapper = await showPage();
    wrapper.vm.newEmail = 'new@example.com';
    wrapper.vm.code = '123456';
    const first = wrapper.vm.setNewEmail();
    await Promise.resolve();
    expect(wrapper.vm.saving).toBe(true);
    await wrapper.vm.setNewEmail();
    expect(request.put).toHaveBeenCalledTimes(1);
    finishRequest({});
    await first;
    await flushPromises();
    expect(wrapper.vm.saving).toBe(false);
  });

  it('sends guests to login when the page shows', async () => {
    app.globalData.id = '';
    const wrapper = mountPage();
    await wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(goLogin).toHaveBeenCalled();
    expect(request.get).not.toHaveBeenCalled();
  });

  it('loads email from stored session when App has not hydrated id', async () => {
    app.globalData.id = '';
    globalThis.uni.getStorageSync = vi.fn((key) => {
      if (key === 'token') return 'token';
      if (key === 'id') return 7;
      return '';
    });
    const wrapper = await showPage();
    expect(goLogin).not.toHaveBeenCalled();
    expect(request.get).toHaveBeenCalledWith('/users/7', null, true, { loading: false });
    expect(wrapper.vm.oldEmail).toBe('old@example.com');
  });
});
