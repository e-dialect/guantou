import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/file', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/services/guantou', () => ({
  createCanForFlavor: vi.fn(),
  createCanWithNameplate: vi.fn(),
  getFlavor: vi.fn(),
  listDialects: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/canDrafts', () => ({
  getCanDraft: vi.fn(),
  listCanDrafts: vi.fn(() => []),
  removeCanDraft: vi.fn(),
  saveCanDraft: vi.fn(),
}));

import CanCreate from '@/pages/cans/create.vue';
import { uploadFile } from '@/services/file';
import { listDialects } from '@/services/guantou';
import { getCanDraft, saveCanDraft } from '@/services/canDrafts';

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
    globalThis.uni = {
      redirectTo: vi.fn(),
      showModal: vi.fn(),
      showToast: vi.fn(),
    };
    saveCanDraft.mockReturnValue({ id: 'draft-1' });
  });

  it('restores form and audio while keeping required-field validation', async () => {
    getCanDraft.mockReturnValue({
      id: 'draft-1',
      mode: 'free',
      targetFlavor: null,
      dialectName: '游洋话',
      form: { concept_text: '膝盖', dialect: null, source_note: '奶奶说的' },
      label: { text_content: '骹头前' },
      audio: { path: '/tmp/knee.mp3', name: 'knee.mp3', origin: 'record' },
    });
    const wrapper = mountCreate();

    wrapper.vm.restoreDraft('draft-1');
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
    wrapper.vm.dialects = [{ id: 1, name: '游洋话' }];
    wrapper.vm.form.concept_text = '膝盖';
    wrapper.vm.form.dialect = 1;
    wrapper.vm.audio = { path: '/tmp/knee.mp3', name: 'knee.mp3', origin: 'record' };

    await wrapper.vm.submit();

    expect(saveCanDraft).toHaveBeenCalledWith(
      expect.objectContaining({ concept_text: '膝盖', dialect: 1 }),
      expect.any(Object),
      expect.objectContaining({
        dialectName: '游洋话',
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

  it('still restores drafts when dialect loading fails', async () => {
    listDialects.mockRejectedValue(new Error('offline'));
    const wrapper = mountCreate();

    await expect(wrapper.vm.loadDialects()).resolves.toBeUndefined();

    expect(uni.showToast).toHaveBeenCalledWith({
      title: '方言点加载失败，可稍后重试',
      icon: 'none',
    });
  });

  it('requires a valid flavor id after restoring supplementation mode', () => {
    getCanDraft.mockReturnValue({
      id: 'draft-2',
      mode: 'flavor',
      targetFlavor: null,
      form: { dialect: 1 },
      label: {},
      audio: { path: '/tmp/moon.mp3' },
    });
    const wrapper = mountCreate();

    wrapper.vm.restoreDraft('draft-2');

    expect(wrapper.vm.mode).toBe('free');
    expect(wrapper.vm.canSubmit).toBe(false);
  });
});
