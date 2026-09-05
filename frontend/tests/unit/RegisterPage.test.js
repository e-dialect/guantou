import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerUser: vi.fn(),
  normalLogin: vi.fn(),
  sendEmailCode: vi.fn(),
}));

vi.mock('@/services/user', () => ({ registerUser: mocks.registerUser }));
vi.mock('@/services/login', () => ({ normalLogin: mocks.normalLogin }));
vi.mock('@/services/verification', () => ({ sendEmailCode: mocks.sendEmailCode }));

const { default: RegisterPage } = await import('@/pages/login/register.vue');

function mountPage() {
  return mount(RegisterPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
      },
    },
  });
}

function fillValidForm(wrapper) {
  wrapper.vm.username = 'collector';
  wrapper.vm.password = 'password123';
  wrapper.vm.passwordConfirmed = 'password123';
  wrapper.vm.email = 'collector@example.com';
  wrapper.vm.code = '123456';
}

describe('register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      showToast: vi.fn(),
    };
    mocks.registerUser.mockResolvedValue({ id: 9 });
    mocks.normalLogin.mockResolvedValue({ id: 9 });
  });

  it('registers then logs in with the new account by email', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);

    await wrapper.vm.register();

    expect(mocks.registerUser).toHaveBeenCalledWith(
      'collector',
      'password123',
      'collector@example.com',
      '123456',
    );
    expect(mocks.normalLogin).toHaveBeenCalledWith('collector', 'password123', { isNew: true });
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('blocks submission when client validation fails', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    wrapper.vm.passwordConfirmed = 'different';

    await wrapper.vm.register();

    expect(mocks.registerUser).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.passwordConfirmed).toBe('两次密码不相同');
  });

  it('keeps email verification behind valid account details', async () => {
    const wrapper = mountPage();

    expect(wrapper.vm.formStep).toBe(1);
    expect(wrapper.text()).not.toContain('邮箱只用于验证身份');
    wrapper.vm.continueToEmail();
    expect(wrapper.vm.errors.username).toBe('请输入用户名');
    expect(wrapper.vm.formStep).toBe(1);

    wrapper.vm.username = '  collector  ';
    wrapper.vm.password = 'password123';
    wrapper.vm.passwordConfirmed = 'password123';
    wrapper.vm.continueToEmail();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.username).toBe('collector');
    expect(wrapper.vm.formStep).toBe(2);
    expect(wrapper.text()).toContain('邮箱只用于验证身份');
  });

  it('sends email code when contact is an email', async () => {
    const wrapper = mountPage();
    wrapper.vm.email = 'collector@example.com';
    mocks.sendEmailCode.mockResolvedValue({});

    await wrapper.vm.getCode();

    expect(mocks.sendEmailCode).toHaveBeenCalledWith('collector@example.com', 'register');
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '验证码已发送',
      icon: 'success',
    });
  });

  it('maps server field errors onto the matching field without a toast', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({
      statusCode: 409,
      message: '该邮箱已被绑定',
      data: { email: '该邮箱已被绑定' },
    });

    await wrapper.vm.register();

    expect(wrapper.vm.errors.email).toBe('该邮箱已被绑定');
    expect(wrapper.vm.errors.username).toBe('');
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('falls back to one status-aware toast for unfielded errors', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({ statusCode: 401, message: '' });

    await wrapper.vm.register();

    expect(uni.showToast).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '验证码错误', icon: 'none' });
  });

  it('recovers the message when empty-body conflicts only expose a reason phrase', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({ statusCode: 409, message: 'Conflict' });

    await wrapper.vm.register();

    expect(uni.showToast).toHaveBeenCalledWith({ title: '用户名或邮箱已存在', icon: 'none' });
  });
});
