import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseForm from '@/components/BaseForm.vue';

const mocks = vi.hoisted(() => ({
  changeUserInfo: vi.fn(),
  getUserInfo: vi.fn(),
  searchUsers: vi.fn(),
  postMail: vi.fn(),
  toIndexPage: vi.fn(),
  toLoginPage: vi.fn(),
}));

vi.mock('@/services/user', () => ({
  changeUserInfo: mocks.changeUserInfo,
  getUserInfo: mocks.getUserInfo,
  searchUsers: mocks.searchUsers,
}));
vi.mock('@/services/mail', () => ({ postMail: mocks.postMail }));
vi.mock('@/routers/login', () => ({ toLoginPage: mocks.toLoginPage }));
vi.mock('@/routers', () => ({ toIndexPage: mocks.toIndexPage }));

const app = {
  globalData: {
    id: 7,
    userInfo: {
      username: 'old-user',
      nickname: '旧昵称',
      telephone: '13800000000',
    },
  },
};

global.getApp = vi.fn(() => app);

const { default: UsernamePage } = await import('@/pages/users/settings/username.vue');
const { default: NicknamePage } = await import('@/pages/users/settings/nickname.vue');
const { default: TelephonePage } = await import('@/pages/users/settings/telephone.vue');
const { default: SendMailPage } = await import('@/pages/mails/send.vue');
const { default: NotFoundPage } = await import('@/pages/error/not-found.vue');

const PageShellStub = {
  name: 'PageShell',
  template: '<div><slot /></div>',
};

function mountPage(component) {
  return mount(component, {
    global: { stubs: { PageShell: PageShellStub } },
  });
}

function makeFormValid(wrapper) {
  const form = wrapper.getComponent(BaseForm);
  form.vm.validate = vi.fn(() => Promise.resolve(true));
  return form;
}

describe('simple TDesign page migrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.uni = {
      navigateBack: vi.fn(),
      showToast: vi.fn(),
    };
    app.globalData.userInfo = {
      username: 'old-user',
      nickname: '旧昵称',
      telephone: '13800000000',
    };
    mocks.changeUserInfo.mockResolvedValue({});
    mocks.getUserInfo.mockResolvedValue({ user: { ...app.globalData.userInfo } });
    mocks.postMail.mockResolvedValue({ id: 9 });
  });

  it('updates a username through the original user service contract', async () => {
    const wrapper = mountPage(UsernamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    makeFormValid(wrapper);
    wrapper.vm.form.username = 'new-user';

    await wrapper.vm.saveUsername();

    expect(mocks.changeUserInfo).toHaveBeenCalledWith(7, expect.objectContaining({
      username: 'new-user',
    }));
    expect(app.globalData.userInfo.username).toBe('new-user');
  });

  it('updates a nickname through the original user service contract', async () => {
    const wrapper = mountPage(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    makeFormValid(wrapper);
    wrapper.vm.form.nickname = '新昵称';

    await wrapper.vm.saveNickname();

    expect(mocks.changeUserInfo).toHaveBeenCalledWith(7, expect.objectContaining({
      nickname: '新昵称',
    }));
  });

  it('keeps the telephone read-modify-write payload', async () => {
    const wrapper = mountPage(TelephonePage);
    makeFormValid(wrapper);
    wrapper.vm.form.telephone = '13900000000';

    await wrapper.vm.savePhone();

    expect(mocks.getUserInfo).toHaveBeenCalledWith(7, true);
    expect(mocks.changeUserInfo).toHaveBeenCalledWith(7, expect.objectContaining({
      telephone: '13900000000',
    }));
  });

  it('submits the existing notification payload', async () => {
    const wrapper = mountPage(SendMailPage);
    makeFormValid(wrapper);
    wrapper.vm.Notification = {
      recipients: ['12'],
      title: '测试邮件',
      content: '正文',
    };
    wrapper.vm.selectedRecipient = {
      id: 12,
      username: 'recipient',
      nickname: '收件人',
    };

    await wrapper.vm.sendEmail();

    expect(mocks.postMail).toHaveBeenCalledWith({
      recipients: ['12'],
      title: '测试邮件',
      content: '正文',
    }, true);
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('keeps the not-found navigation action', () => {
    const wrapper = mountPage(NotFoundPage);
    wrapper.vm.goHome();
    expect(mocks.toIndexPage).toHaveBeenCalledOnce();
  });
});
