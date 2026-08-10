import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/file', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/services/guantou', () => ({
  createCanForFlavor: vi.fn(),
  createCanWithNameplate: vi.fn(),
  getFlavor: vi.fn(),
  listAllDialects: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  isLoggedIn: vi.fn(() => true),
  requireAuth: vi.fn(() => true),
  saveInterceptIntent: vi.fn(),
}));

vi.mock('@/services/canDrafts', () => ({
  createCanDraftId: vi.fn(() => 'draft-1'),
  getCanDraftOwnerScope: vi.fn(() => 'user:7'),
  getCanDraftWithAudio: vi.fn(),
  listCanDrafts: vi.fn(() => []),
  removeCanDraft: vi.fn(),
  saveCanDraft: vi.fn(),
}));

vi.mock('@/services/canDraftAudio', () => ({
  releaseDraftAudioUrl: vi.fn(),
}));

import CanCreate from '@/pages/cans/create.vue';
import { uploadFile } from '@/services/file';
import {
  createCanForFlavor,
  createCanWithNameplate,
  listAllDialects,
} from '@/services/guantou';
import {
  getCanDraftOwnerScope,
  getCanDraftWithAudio,
  saveCanDraft,
} from '@/services/canDrafts';
import { saveInterceptIntent } from '@/services/authGuard';

function mountCreate() {
  return mount(CanCreate, {
    global: {
      stubs: {
        AudioCapture: true,
        PageShell: {
          props: ['title'],
          template: '<main><h1>{{ title }}</h1><slot /></main>',
        },
        picker: {
          template: '<div><slot /></div>',
        },
        'uni-forms': {
          template: '<form><slot /></form>',
        },
        'uni-forms-item': {
          props: ['label'],
          template: '<label>{{ label }}<slot /></label>',
        },
      },
    },
  });
}

describe('can creation draft recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFile.mockReset();
    createCanWithNameplate.mockReset();
    createCanForFlavor.mockReset();
    getCanDraftOwnerScope.mockReturnValue('user:7');
    globalThis.uni = {
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
      showModal: vi.fn(),
      showToast: vi.fn(),
    };
    saveCanDraft.mockImplementation(async (form, label, meta) => ({
      id: meta.id || 'draft-1',
      ownerScope: meta.ownerScope || 'user:7',
      audio: meta.audio?.path ? {
        ...meta.audio,
        persisted: true,
        storage: 'saved-file',
        available: true,
      } : null,
    }));
  });

  it('restores form and audio while keeping required-field validation', async () => {
    getCanDraftWithAudio.mockResolvedValue({
      id: 'draft-1',
      ownerScope: 'user:7',
      mode: 'free',
      targetFlavor: null,
      dialectName: '游洋话',
      form: { concept_text: '膝盖', dialect: null, source_note: '奶奶说的' },
      label: { text_content: '骹头前' },
      audio: { path: '/tmp/knee.mp3', name: 'knee.mp3', origin: 'record' },
    });
    const wrapper = mountCreate();

    await wrapper.vm.restoreDraft('draft-1');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.form.concept_text).toBe('膝盖');
    expect(wrapper.vm.label.text_content).toBe('骹头前');
    expect(wrapper.vm.audio.path).toBe('/tmp/knee.mp3');
    expect(wrapper.vm.dialectLabel).toBe('游洋话');
    expect(wrapper.vm.canSubmit).toBe(false);
  });

  it('saves the unchanged form and recording when upload fails', async () => {
    uploadFile.mockRejectedValue(new Error('network failed'));
    const wrapper = mountCreate();
    wrapper.vm.dialects = [{ id: 1, name: '游洋话', qualified_code: '闽.莆仙.游洋' }];
    wrapper.vm.form.concept_text = '膝盖';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/tmp/knee.mp3', name: 'knee.mp3', origin: 'record' };

    await wrapper.vm.submit();

    expect(saveCanDraft).toHaveBeenCalledWith(
      expect.objectContaining({ concept_text: '膝盖', submitted_dialect_id: 1 }),
      expect.any(Object),
      expect.objectContaining({
        dialectName: '闽.莆仙.游洋',
        audio: expect.objectContaining({ path: '/tmp/knee.mp3' }),
        reason: 'network failed',
      }),
    );
    expect(wrapper.vm.form.concept_text).toBe('膝盖');
    expect(wrapper.vm.audio.path).toBe('/tmp/knee.mp3');
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '提交失败，已保存草稿',
      icon: 'none',
    });
  });

  it('uploads the persistent path after saving moves a temporary mini-program file', async () => {
    const availablePaths = new Set(['wxfile://temp.mp3']);
    saveCanDraft.mockImplementation(async (form, label, meta) => {
      if (meta.audio.path === 'wxfile://temp.mp3') {
        availablePaths.delete('wxfile://temp.mp3');
        availablePaths.add('wxfile://saved.mp3');
      }
      return {
        id: meta.id,
        ownerScope: meta.ownerScope,
        audio: {
          ...meta.audio,
          path: 'wxfile://saved.mp3',
          storage: 'saved-file',
          persisted: true,
          available: true,
        },
      };
    });
    uploadFile.mockImplementation(async (path) => {
      if (!availablePaths.has(path)) throw new Error('file does not exist');
      return { url: '/media/saved.mp3' };
    });
    createCanWithNameplate.mockResolvedValue({ id: 21 });
    const wrapper = mountCreate();
    wrapper.vm.dialects = [{ id: 1, name: '游洋话', qualified_code: '闽.莆仙.游洋' }];
    wrapper.vm.form.concept_text = '膝盖';
    wrapper.vm.form.submitted_dialect_id = 1;

    wrapper.vm.onAudioChange({
      path: 'wxfile://temp.mp3',
      name: 'voice.mp3',
      origin: 'record',
    });
    const audioChangeSave = wrapper.vm.draftSavePromise;
    const pageHideSave = wrapper.vm.persistDirtyDraft('page_hidden');
    await Promise.all([audioChangeSave, pageHideSave]);
    await wrapper.vm.submit();

    expect(wrapper.vm.audio.path).toBe('wxfile://saved.mp3');
    expect(saveCanDraft).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        audio: expect.objectContaining({ path: 'wxfile://saved.mp3' }),
      }),
    );
    expect(saveCanDraft).toHaveBeenCalledTimes(2);
    expect(uploadFile).toHaveBeenCalledWith('wxfile://saved.mp3');
    expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/cans/details?id=21' });
  });

  it('still restores drafts when dialect loading fails', async () => {
    listAllDialects.mockRejectedValue(new Error('offline'));
    const wrapper = mountCreate();

    await expect(wrapper.vm.loadDialects()).resolves.toBeUndefined();

    expect(uni.showToast).toHaveBeenCalledWith({
      title: '方言点加载失败，可稍后重试',
      icon: 'none',
    });
  });

  it('records an explicit return target when an expired token interrupts submission', async () => {
    uploadFile.mockRejectedValue({ statusCode: 401, message: 'expired' });
    const wrapper = mountCreate();
    wrapper.vm.dialects = [{ id: 1, name: '游洋话', qualified_code: '闽.莆仙.游洋' }];
    wrapper.vm.form.concept_text = '膝盖';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/tmp/knee.mp3', name: 'knee.mp3', origin: 'record' };

    await wrapper.vm.submit();

    expect(saveInterceptIntent).toHaveBeenCalledWith({
      action: 'record_can',
      context: expect.objectContaining({
        page: 'can_create',
        returnRoute: '/pages/cans/create',
        ownerScope: 'user:7',
      }),
    });
  });

  it('requires a valid flavor id after restoring supplementation mode', () => {
    getCanDraftWithAudio.mockResolvedValue({
      id: 'draft-2',
      ownerScope: 'user:7',
      mode: 'flavor',
      targetFlavor: null,
      form: { dialect: 1 },
      label: {},
      audio: { path: '/tmp/moon.mp3' },
    });
    const wrapper = mountCreate();

    return wrapper.vm.restoreDraft('draft-2').then(() => {
      expect(wrapper.vm.mode).toBe('free');
      expect(wrapper.vm.canSubmit).toBe(false);
    });
  });

  it('marks a missing persisted recording as invalid and blocks submission', async () => {
    getCanDraftWithAudio.mockResolvedValue({
      id: 'draft-3',
      ownerScope: 'user:7',
      mode: 'free',
      form: { concept_text: '月亮', dialect: 1 },
      label: {},
      audio: {
        path: '',
        persisted: true,
        available: false,
        invalid: true,
      },
    });
    const wrapper = mountCreate();

    await wrapper.vm.restoreDraft('draft-3');

    expect(wrapper.vm.audio.invalid).toBe(true);
    expect(wrapper.vm.canSubmit).toBe(false);
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '草稿录音已失效，请重新录制',
      icon: 'none',
    });
  });

  it('blocks submission and closes the page when another account is now signed in', async () => {
    const wrapper = mountCreate();
    wrapper.vm.draftId = 'draft-1';
    wrapper.vm.draftOwnerScope = 'user:7';
    wrapper.vm.form.concept_text = '膝盖';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/saved/a.mp3', persisted: true, available: true };
    getCanDraftOwnerScope.mockReturnValue('user:8');

    await wrapper.vm.submit();

    expect(wrapper.vm.draftAccessBlocked).toBe(true);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/index?status=me' });
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '该草稿属于其他账号',
      icon: 'none',
    });
  });

  it('submits supplementation mode with the locked flavor', async () => {
    uploadFile.mockResolvedValue({ url: 'https://example.test/moon.mp3', duration_ms: 2300 });
    createCanForFlavor.mockResolvedValue({ id: 31 });
    const wrapper = mountCreate();
    wrapper.vm.mode = 'flavor';
    wrapper.vm.targetFlavor = { id: 12, name: '月亮' };
    wrapper.vm.form.concept_text = '月亮';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/tmp/moon.mp3', name: 'moon.mp3', origin: 'record' };

    await wrapper.vm.submit();

    expect(createCanForFlavor).toHaveBeenCalledWith({
      can: expect.objectContaining({
        concept_text: '月亮',
        submitted_dialect_id: 1,
        audio_url: 'https://example.test/moon.mp3',
        duration_ms: 2300,
      }),
      flavorId: 12,
    });
    expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/cans/details?id=31' });
  });
});
