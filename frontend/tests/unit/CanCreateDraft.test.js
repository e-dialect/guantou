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

vi.mock('@/services/feedback', () => ({ notify: vi.fn(), confirm: vi.fn() }));

import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import { confirm, notify } from '@/services/feedback';
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
  listCanDrafts,
  removeCanDraft,
  saveCanDraft,
} from '@/services/canDrafts';
import { isLoggedIn, requireAuth, saveInterceptIntent } from '@/services/authGuard';
import { releaseDraftAudioUrl } from '@/services/canDraftAudio';

function mountCreate() {
  const wrapper = mount(CanCreate, {
    global: {
      stubs: {
        AudioCapture: true,
        PageShell: {
          props: ['title'],
          template: '<main><h1>{{ title }}</h1><slot /></main>',
        },
      },
    },
  });
  wrapper.getComponent(BaseForm).vm.validate = vi.fn().mockResolvedValue(true);
  return wrapper;
}

describe('can creation draft recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFile.mockReset();
    createCanWithNameplate.mockReset();
    createCanForFlavor.mockReset();
    getCanDraftOwnerScope.mockReturnValue('user:7');
    isLoggedIn.mockReturnValue(true);
    listCanDrafts.mockReturnValue([]);
    globalThis.uni = {
      redirectTo: vi.fn(),
      reLaunch: vi.fn(),
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
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

  it('cascades dialect columns and clears the old leaf when an ancestor changes', async () => {
    listAllDialects.mockResolvedValue([
      { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
      { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
      { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋', sort_order: 1 },
      { id: 4, name: '闽南片', qualified_code: '闽.闽南', sort_order: 2 },
      { id: 5, name: '厦门话', qualified_code: '闽.闽南.厦门', sort_order: 1 },
      { id: 6, name: '粤语', qualified_code: '粤', sort_order: 2 },
      { id: 7, name: '广府片', qualified_code: '粤.广府', sort_order: 1 },
    ]);
    const wrapper = mountCreate();

    await wrapper.vm.loadDialects();
    wrapper.vm.onDialectChange({ detail: { value: [0, 0, 0] } });
    expect(wrapper.vm.form.submitted_dialect_id).toBe(3);

    wrapper.vm.onDialectColumnChange({ detail: { column: 1, value: 1 } });
    expect(wrapper.vm.form.submitted_dialect_id).toBeNull();
    expect(wrapper.vm.dialectColumns[2].map((item) => item.name)).toEqual(['厦门话']);

    wrapper.vm.onDialectChange({ detail: { value: [0, 1, 0] } });
    expect(wrapper.vm.form.submitted_dialect_id).toBe(5);
    expect(wrapper.vm.dialectLabel).toBe('闽.闽南.厦门');

    wrapper.vm.onDialectColumnChange({ detail: { column: 0, value: 1 } });
    expect(wrapper.vm.form.submitted_dialect_id).toBeNull();
    expect(wrapper.vm.dialectColumns).toHaveLength(2);
    expect(wrapper.vm.dialectColumns[1].map((item) => item.name)).toEqual(['广府片']);

    wrapper.vm.onDialectChange({ detail: { value: [1, 0] } });
    expect(wrapper.vm.form.submitted_dialect_id).toBe(7);
  });

  it('shows the complete dialect path and remembers a cascader selection', async () => {
    listAllDialects.mockResolvedValue([
      { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
      { id: 4, name: '闽南片', qualified_code: '闽.闽南', sort_order: 1 },
      { id: 5, name: '厦门话', qualified_code: '闽.闽南.厦门', sort_order: 1 },
    ]);
    const wrapper = mountCreate();
    await wrapper.vm.loadDialects();
    const [root] = wrapper.vm.dialectTree;
    const [branch] = root.children;
    const [leaf] = branch.children;

    wrapper.vm.onDialectCascadeChange({
      value: leaf.id,
      selectedOptions: [root, branch, leaf],
    });

    expect(wrapper.vm.dialectDisplayLabel).toBe('闽语 · 闽南片 · 厦门话');
    expect(wrapper.vm.filterDialectOption('厦门', leaf, [root, branch])).toBe(true);
    expect(wrapper.vm.filterDialectOption('闽.闽南.厦门', leaf, [root, branch])).toBe(true);
    expect(uni.setStorageSync).toHaveBeenCalledWith(
      'can_create_recent_dialects_v1:user:7',
      JSON.stringify([5]),
    );
  });

  it('restores a draft leaf into every dialect cascade column', async () => {
    getCanDraftWithAudio.mockResolvedValue({
      id: 'draft-cascade',
      ownerScope: 'user:7',
      mode: 'free',
      dialectName: '闽.闽南.厦门',
      form: { concept_text: '月亮', submitted_dialect_id: 5 },
      label: {},
      audio: { path: '/tmp/moon.mp3', name: 'moon.mp3', origin: 'record' },
    });
    listAllDialects.mockResolvedValue([
      { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
      { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
      { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋', sort_order: 1 },
      { id: 4, name: '闽南片', qualified_code: '闽.闽南', sort_order: 2 },
      { id: 5, name: '厦门话', qualified_code: '闽.闽南.厦门', sort_order: 1 },
    ]);
    const wrapper = mountCreate();

    await wrapper.vm.restoreDraft('draft-cascade');
    await wrapper.vm.loadDialects();

    expect(wrapper.vm.dialectIndexes).toEqual([0, 1, 0]);
    expect(wrapper.vm.dialectColumns.map(
      (options, index) => options[wrapper.vm.dialectIndexes[index]].name,
    )).toEqual(['闽语', '闽南片', '厦门话']);
    expect(wrapper.vm.form.submitted_dialect_id).toBe(5);
    expect(wrapper.vm.dialectLabel).toBe('闽.闽南.厦门');
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
    expect(notify).toHaveBeenCalledWith({
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

    expect(notify).toHaveBeenCalledWith({
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
    expect(notify).toHaveBeenCalledWith({
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
    expect(notify).toHaveBeenCalledWith({
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

  it('persists a guest draft before requesting login with its return context', async () => {
    isLoggedIn.mockReturnValue(false);
    getCanDraftOwnerScope.mockReturnValue('anonymous:guest');
    const wrapper = mountCreate();
    wrapper.vm.form.concept_text = '月亮';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: 'blob:moon', origin: 'record' };

    await wrapper.vm.submit();

    expect(uploadFile).not.toHaveBeenCalled();
    expect(saveCanDraft).toHaveBeenCalledWith(
      expect.objectContaining({ concept_text: '月亮' }),
      expect.any(Object),
      expect.objectContaining({ ownerScope: 'anonymous:guest', reason: 'login_required' }),
    );
    expect(requireAuth).toHaveBeenCalledWith('record_can', expect.objectContaining({
      returnRoute: '/pages/cans/create', draftId: 'draft-1', ownerScope: 'anonymous:guest',
    }));
    expect(removeCanDraft).not.toHaveBeenCalled();
  });

  it('keeps a guest on the form if saving before login fails', async () => {
    isLoggedIn.mockReturnValue(false);
    saveCanDraft.mockRejectedValue(new Error('storage full'));
    const wrapper = mountCreate();
    wrapper.vm.form.concept_text = '月亮';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: 'blob:moon' };

    await wrapper.vm.submit();

    expect(requireAuth).not.toHaveBeenCalled();
    expect(wrapper.vm.audio.path).toBe('blob:moon');
    expect(wrapper.vm.submitted).toBe(false);
  });

  it('uses the signed-in owner for subsequent saves after a guest logs in', async () => {
    getCanDraftOwnerScope.mockReturnValue('anonymous:guest');
    const wrapper = mountCreate();
    wrapper.vm.form.concept_text = '月亮';
    getCanDraftOwnerScope.mockReturnValue('user:7');

    CanCreate.onShow.call(wrapper.vm);
    await wrapper.vm.persistDirtyDraft('page_hidden');

    expect(saveCanDraft).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), expect.objectContaining({ ownerScope: 'user:7' }),
    );
  });

  it('cleans up the owner-scoped draft only after creation succeeds', async () => {
    uploadFile.mockResolvedValue({ url: '/media/moon.mp3', duration_ms: 2200 });
    createCanWithNameplate.mockResolvedValue({ id: 41 });
    const wrapper = mountCreate();
    wrapper.vm.draftId = 'draft-existing';
    wrapper.vm.form.concept_text = '月亮';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/saved/moon.mp3' };
    wrapper.vm.label.text_content = '月娘';
    wrapper.vm.label.source = { type: 'oral', attributed_to: '奶奶', note: '小时候听到' };

    await wrapper.vm.submit();
    await wrapper.vm.persistDirtyDraft('page_hidden');

    expect(createCanWithNameplate).toHaveBeenCalledWith({
      can: expect.objectContaining({ audio_url: '/media/moon.mp3', duration_ms: 2200 }),
      label: expect.objectContaining({
        text_content: '月娘',
        source: { type: 'oral', attributed_to: '奶奶', note: '小时候听到' },
      }),
    });
    expect(removeCanDraft).toHaveBeenCalledWith('draft-existing', 'user:7');
    expect(releaseDraftAudioUrl).toHaveBeenCalledWith(wrapper.vm.audio);
    expect(wrapper.vm.submitted).toBe(true);
    expect(saveCanDraft).not.toHaveBeenCalled();
    expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/cans/details?id=41' });
  });

  it('waits for primitive validation and blocks both invalid and duplicate submissions', async () => {
    const wrapper = mountCreate();
    wrapper.vm.form.concept_text = '月亮';
    wrapper.vm.form.submitted_dialect_id = 1;
    wrapper.vm.audio = { path: '/saved/moon.mp3' };
    let resolveValidation;
    const validate = wrapper.getComponent(BaseForm).vm.validate;
    validate.mockImplementation(() => new Promise((resolve) => { resolveValidation = resolve; }));

    const pending = wrapper.vm.submit();
    await wrapper.vm.submit();
    expect(validate).toHaveBeenCalledTimes(1);
    expect(uploadFile).not.toHaveBeenCalled();
    resolveValidation({ concept_text: [{ message: '请填写普通话概念' }] });
    await pending;

    expect(uploadFile).not.toHaveBeenCalled();
    expect(wrapper.vm.submitting).toBe(false);
    expect(wrapper.vm.rules.concept_text[0].validator('  ')).toBe(false);
    wrapper.vm.mode = 'flavor';
    expect(wrapper.vm.rules.concept_text[0].validator('月亮')).toBe(false);
    wrapper.vm.targetFlavor.id = 12;
    expect(wrapper.vm.rules.concept_text[0].validator('')).toBe(true);
  });

  it('keeps optional fields bound to the original payload and clears their server errors', async () => {
    const wrapper = mountCreate();
    wrapper.vm.optionalOpen = true;
    wrapper.vm.fieldErrors = { note: '来源有误' };
    await wrapper.vm.$nextTick();
    const note = wrapper.findAllComponents(BaseField)
      .find((field) => field.props('name') === 'label.source.note');

    expect(note.props('required')).toBe(false);
    expect(note.props('error')).toBe('来源有误');
    note.vm.$emit('update:modelValue', '小时候听奶奶说的');
    note.vm.$emit('change', '小时候听奶奶说的');
    wrapper.vm.onEvidenceChange({ value: [3] });
    wrapper.vm.onSourceTypeChange({ value: ['book'] });
    wrapper.vm.onPackageTypeChange({ value: ['popular'] });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.label.source).toMatchObject({ type: 'book', note: '小时候听奶奶说的' });
    expect(wrapper.vm.label.evidence_level).toBe(3);
    expect(wrapper.vm.label.package_type).toBe('popular');
    expect(wrapper.vm.fieldErrors.note).toBeUndefined();
    expect(wrapper.vm.formData.label).toBe(wrapper.vm.label);
    expect(wrapper.vm.form).not.toHaveProperty('label');
  });

  it.each([true, false])('restores a suggested draft only when confirmed (%s)', async (accepted) => {
    listCanDrafts.mockReturnValue([{ id: 'draft-restore' }]);
    confirm.mockResolvedValue(accepted);
    getCanDraftWithAudio.mockResolvedValue({
      id: 'draft-restore', ownerScope: 'user:7', mode: 'free',
      form: { concept_text: '月亮' }, label: {}, audio: { path: '/saved/moon.mp3' },
    });
    const wrapper = mountCreate();

    await wrapper.vm.restoreDraftIfNeeded({});

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '发现未完成草稿' }));
    expect(wrapper.vm.form.concept_text).toBe(accepted ? '月亮' : '');
    expect(getCanDraftWithAudio).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });
});
