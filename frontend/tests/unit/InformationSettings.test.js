import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    goLogin: vi.fn(),
    goUserEmail: vi.fn(),
    goUserNickname: vi.fn(),
    goUserPhone: vi.fn(),
    goUserUsername: vi.fn(),
  };
});

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/services/file', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(),
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

import {
  goLogin,
  goUserEmail,
  goUserNickname,
  goUserPhone,
  goUserUsername,
} from '@/services/navigation';
import { notify, notifySuccess } from '@/services/feedback';
import { uploadFile } from '@/services/file';
import { listAllDialects } from '@/services/guantou';
import request from '@/utils/request';

const dialects = [
  { id: 3, name: '四川话', qualified_code: '西南官话.四川', path_names: ['西南官话', '四川话'] },
  { id: 5, name: '闽南语', qualified_code: '闽南.厦门', path_names: ['闽语', '闽南语'] },
];

const profile = {
  user: {
    id: 7,
    username: 'collector',
    nickname: '采集者',
    email: 'c@example.com',
    telephone: '13900000001',
    avatar: 'https://example.com/a.png',
    birthday: '1991-02-03',
    primary_dialect: {
      id: 3,
      name: '四川话',
      qualified_code: '西南官话.四川',
      path_names: ['西南官话', '四川话'],
    },
  },
};

const app = {
  globalData: {
    id: 7,
    userInfo: profile.user,
  },
};
globalThis.getApp = vi.fn(() => app);

const { default: InformationPage } = await import('@/pages/users/settings/information.vue');

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/users/settings/information.vue'),
  'utf8',
);

function mountPage() {
  return mount(InformationPage, {
    global: {
      stubs: {
        PageShell: {
          template: '<main><slot name="before" /><slot /></main>',
        },
        'scroll-view': { template: '<div><slot /></div>' },
        SectionBlock: { template: '<section><slot /></section>' },
        TCell: {
          props: {
            ariaLabel: { type: String, default: '' },
            arrow: { type: Boolean, default: false },
            bordered: { type: Boolean, default: true },
            hover: { type: Boolean, default: false },
            note: { type: String, default: '' },
            title: { type: String, default: '' },
          },
          emits: ['click'],
          template: `
            <button
              class="profile-cell-stub"
              :aria-label="ariaLabel"
              :data-arrow="String(arrow)"
              :data-note="note"
              :data-title="title"
              @click="$emit('click')"
            >
              {{ title }} {{ note }}
            </button>
          `,
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

describe('information settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.id = 7;
    app.globalData.userInfo = profile.user;
    globalThis.uni = {
      chooseImage: vi.fn(),
      chooseMessageFile: vi.fn(),
      setStorageSync: vi.fn(),
      showToast: vi.fn(),
    };
    listAllDialects.mockResolvedValue(dialects);
    request.get.mockResolvedValue(profile);
    request.put.mockResolvedValue({ token: 'token', user: profile.user });
    uploadFile.mockResolvedValue({ url: 'https://example.com/new.png' });
  });

  it('uses PageShell, TDesign pickers and no native picker or ColorUI', () => {
    expect(source).toContain('getUserInfo');
    expect(source).toContain('changeUserInfo');
    expect(source).toContain('PageShell');
    expect(source).toContain('BaseButton');
    expect(source).toContain('TDateTimePicker');
    expect(source).toContain('TCell');
    expect(source).toContain('DialectSelector');
    expect(source).toContain('open-type="chooseAvatar"');
    expect(source).toContain('从相册选择');
    expect(source).toContain('chooseMessageFile');
    expect(source).not.toContain('type="nickname"');
    expect(source).not.toContain('微信头像和聊天记录需要在小程序里使用');
    expect(source).not.toContain('H5 用相册');
    expect(source).toContain('overflow-wrap: anywhere');
    expect(source).toContain('公开档案');
    expect(source).toContain('仅自己可见');
    expect(source).not.toMatch(/<picker[\s>]/);
    expect(source).not.toContain('cu-form-group');
    expect(source).not.toContain('uni-forms');
    expect(source.match(/<t-cell\b/g)).toHaveLength(6);
    expect(source.match(/role="button"/g)).toHaveLength(6);
    expect(source.match(/tabindex="0"/g)).toHaveLength(6);
    expect(source.match(/@keydown\.enter=/g)).toHaveLength(6);
    expect(source.match(/@keydown\.space\.prevent=/g)).toHaveLength(6);
    expect(source).not.toContain('class="row pressable"');
    expect(source).not.toContain('将会默认公开');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('exposes six discoverable setting cells and preserves their actions', async () => {
    const wrapper = await showPage();
    const cells = wrapper.findAll('.profile-cell-stub');

    expect(cells.map((cell) => cell.attributes('data-title'))).toEqual([
      '用户名',
      '昵称',
      '邮箱',
      '手机',
      '生日',
      '发音默认地点',
    ]);
    expect(cells.every((cell) => cell.attributes('data-arrow') === 'true')).toBe(true);
    expect(cells.at(-1).attributes('data-note')).toBe('西南官话 › 四川话');

    await cells[0].trigger('click');
    await cells[1].trigger('click');
    await cells[2].trigger('click');
    await cells[3].trigger('click');
    expect(goUserUsername).toHaveBeenCalledOnce();
    expect(goUserNickname).toHaveBeenCalledOnce();
    expect(goUserEmail).toHaveBeenCalledOnce();
    expect(goUserPhone).toHaveBeenCalledOnce();

    await cells[4].trigger('click');
    await cells[5].trigger('click');
    expect(wrapper.vm.birthdayPickerOpen).toBe(true);
    expect(wrapper.vm.dialectPickerOpen).toBe(true);
  });

  it('loads the profile payload and selected dialect id', async () => {
    const wrapper = await showPage();
    expect(listAllDialects).toHaveBeenCalled();
    expect(request.get).toHaveBeenCalledWith('/users/7', null, true, { loading: false });
    expect(wrapper.vm.date).toBe('1991-02-03');
    expect(wrapper.vm.dialectIndex).toBe(0);
    expect(wrapper.vm.selectedDialectLabel).toBe('西南官话 › 四川话');
    expect(wrapper.vm.canUseWechatAuth).toBe(false);
    expect(wrapper.vm.avatarHint).toBe('点击头像更换，可用相册或相机选取。');
  });

  it('saves birthday and dialect with the existing user payload', async () => {
    const wrapper = await showPage();
    await wrapper.vm.onBirthdayConfirm({ value: '1992-08-08' });
    await flushPromises();
    expect(request.put).toHaveBeenCalledWith(
      '/users/7',
      { user: expect.objectContaining({ birthday: '1992-08-08' }) },
      true,
    );
    expect(notifySuccess).toHaveBeenCalledWith('修改成功');

    request.put.mockClear();
    await wrapper.vm.onDialectChange({ value: 5 });
    await flushPromises();
    expect(request.put).toHaveBeenCalledWith(
      '/users/7',
      { user: expect.objectContaining({ primary_dialect_id: 5 }) },
      true,
    );
    expect(wrapper.vm.dialectIndex).toBe(1);
  });

  it('does not persist when a picker is cancelled', async () => {
    const wrapper = await showPage();
    wrapper.vm.birthdayPickerOpen = true;
    wrapper.vm.dialectPickerOpen = true;
    wrapper.vm.closeBirthdayPicker();
    wrapper.vm.closeDialectPicker();
    expect(wrapper.vm.birthdayPickerOpen).toBe(false);
    expect(wrapper.vm.dialectPickerOpen).toBe(false);
    expect(request.put).not.toHaveBeenCalled();
    expect(wrapper.vm.date).toBe('1991-02-03');
    expect(wrapper.vm.dialectIndex).toBe(0);
  });

  it('maps save failures onto the form and toast', async () => {
    const wrapper = await showPage();
    request.put.mockRejectedValueOnce({
      message: '请求参数校验失败',
      data: { primary_dialect: { code: 'invalid', message: '方言无效' } },
    });
    await wrapper.vm.onDialectChange({ value: 5 });
    await flushPromises();
    expect(wrapper.vm.saveError).toBe('方言无效');
    expect(notify).toHaveBeenCalledWith({ title: '方言无效' });
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('uploads an avatar then writes the returned url', async () => {
    const wrapper = await showPage();
    await wrapper.vm.saveAvatarFromPath('/tmp/avatar.jpg');
    await flushPromises();
    expect(uploadFile).toHaveBeenCalledWith('/tmp/avatar.jpg');
    expect(request.put).toHaveBeenCalledWith(
      '/users/7',
      { user: expect.objectContaining({ avatar: 'https://example.com/new.png' }) },
      true,
    );
    expect(wrapper.vm.avatarSheetOpen).toBe(false);
    expect(wrapper.vm.avatarPreview).toBe('');
    expect(wrapper.vm.avatarSrc).toBe(profile.user.avatar);
  });

  it('does not refetch the profile while an avatar upload is in flight', async () => {
    const wrapper = await showPage();
    request.get.mockClear();
    wrapper.vm.avatarBusy = true;
    await wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(request.get).not.toHaveBeenCalled();
    wrapper.vm.avatarBusy = false;
    wrapper.vm.pickingAvatar = true;
    await wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(request.get).not.toHaveBeenCalled();
  });

  it('previews the local file before the upload finishes', async () => {
    let finishUpload;
    uploadFile.mockImplementationOnce(
      () => new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    const wrapper = await showPage();
    const pending = wrapper.vm.saveAvatarFromPath('/tmp/avatar.jpg');
    await flushPromises();
    expect(wrapper.vm.avatarPreview).toBe('/tmp/avatar.jpg');
    expect(wrapper.vm.avatarSrc).toBe('/tmp/avatar.jpg');
    finishUpload({ url: 'https://example.com/new.png' });
    await pending;
    await flushPromises();
    expect(wrapper.vm.avatarPreview).toBe('');
  });

  it('keeps the sheet open and notifies when avatar upload fails', async () => {
    const wrapper = await showPage();
    wrapper.vm.avatarSheetOpen = true;
    uploadFile.mockRejectedValueOnce({
      message: '文件过大',
      data: { avatar: { message: '文件过大' } },
    });
    await wrapper.vm.saveAvatarFromPath('/tmp/avatar.jpg');
    await flushPromises();
    expect(request.put).not.toHaveBeenCalled();
    expect(wrapper.vm.saveError).toBe('文件过大');
    expect(notify).toHaveBeenCalledWith({ title: '文件过大' });
    expect(wrapper.vm.avatarSheetOpen).toBe(true);
  });

  it('notifies when avatar upload returns no url', async () => {
    const wrapper = await showPage();
    uploadFile.mockResolvedValueOnce({});
    await wrapper.vm.saveAvatarFromPath('/tmp/avatar.jpg');
    await flushPromises();
    expect(request.put).not.toHaveBeenCalled();
    expect(wrapper.vm.saveError).toBe('头像上传失败，请检查网络后重试');
    expect(wrapper.vm.avatarPreview).toBe('');
  });

  it('ignores a cancelled album picker', async () => {
    const wrapper = await showPage();
    uni.chooseImage.mockImplementation(({ fail }) => {
      fail({ errMsg: 'chooseImage:fail cancel' });
    });
    await wrapper.vm.pickFromAlbum();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends guests to login when the page shows', async () => {
    app.globalData.id = '';
    const wrapper = mountPage();
    await wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(goLogin).toHaveBeenCalled();
    expect(request.get).not.toHaveBeenCalled();
  });
});
