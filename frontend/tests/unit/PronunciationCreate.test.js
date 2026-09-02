import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';

vi.mock('@/services/guantou', () => ({
  createPronunciation: vi.fn(),
  getFlavor: vi.fn(),
  listAllDialects: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

const { notify, notifySuccess } = await import('@/services/feedback');

const {
  createPronunciation,
  getFlavor,
  listAllDialects,
} = await import('@/services/guantou');
const PronunciationModule = await import('@/pages/pronunciations/create.vue');
const PronunciationCreate = PronunciationModule.default;
const {
  buildDialectTree,
  findDialectPath,
  pronunciationApiErrors,
  validatePronunciationDraft,
} = PronunciationModule;

function validDraft() {
  return {
    ipa: 'hiŋ²³',
    package_id: 2,
    dialect_id: 3,
    base_romanization: '',
    surface_romanization: '',
    sandhi_environment: '',
  };
}

function createPage(overrides = {}) {
  const page = {
    ...PronunciationCreate.data(),
    ...PronunciationCreate.methods,
    flavorId: 1,
    flavor: { id: 1, name: '行走' },
    $nextTick: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  Object.entries(PronunciationCreate.computed).forEach(([key, computed]) => {
    Object.defineProperty(page, key, {
      get: () => (typeof computed === 'function' ? computed : computed.get).call(page),
    });
  });
  page.$refs = { form: {
    clearValidate: vi.fn(),
    validate: vi.fn(async () => {
      const errors = {};
      Object.entries(page.rules).forEach(([field, rules]) => {
        const result = rules[0].validator();
        if (result !== true) errors[field] = [result];
      });
      return Object.keys(errors).length ? errors : true;
    }),
  } };
  return page;
}

describe('pronunciation authoring flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    globalThis.getCurrentPages = vi.fn(() => [{}, {}]);
    globalThis.getApp = vi.fn(() => ({ globalData: {} }));
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
      navigateBack: vi.fn(),
      setStorageSync: vi.fn(),
      showToast: vi.fn(),
      reLaunch: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete globalThis.getCurrentPages;
    delete globalThis.getApp;
  });

  it('requires IPA, a linked package, a dialect, and paired sandhi forms', () => {
    expect(validatePronunciationDraft({})).toMatchObject({
      ipa: expect.any(String),
      package_id: expect.any(String),
      dialect_id: expect.any(String),
    });
    expect(validatePronunciationDraft({
      ...validDraft(),
      base_romanization: 'hing5',
      surface_romanization: '',
    })).toMatchObject({
      base_romanization: expect.any(String),
      surface_romanization: expect.any(String),
    });
  });

  it('limits package choices to the locked flavor package links', async () => {
    getFlavor.mockResolvedValue({
      id: 1,
      name: '行走',
      package_links: [
        { mapping_type: 'primary', package: { id: 2, text: '行' } },
      ],
    });
    listAllDialects.mockResolvedValue([
      { id: 3, depth: 1, qualified_code: '闽.莆仙' },
    ]);
    const page = createPage();

    await page.loadOptions();

    expect(page.packageOptions).toEqual([
      { value: 2, label: '行 · primary' },
    ]);
    expect(page.draft.package_id).toBe(2);
  });

  it('maps backend 400 field errors to their matching controls', () => {
    expect(pronunciationApiErrors({
      data: {
        package_id: { message: '该写法尚未与所选义项建立关联' },
        ipa: { message: '不能为空' },
      },
    })).toEqual({
      package_id: '该写法尚未与所选义项建立关联',
      ipa: '不能为空',
    });
  });

  it('uses the same hierarchical dialect path as the can creation cascader', () => {
    const tree = buildDialectTree([
      { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
      { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
      { id: 3, name: '仙游', qualified_code: '闽.莆仙.仙游', sort_order: 1 },
      { id: 4, name: '城关', qualified_code: '闽.莆仙.仙游.城关', sort_order: 1 },
    ]);

    expect(findDialectPath(tree, 4).map((item) => item.name)).toEqual([
      '闽语',
      '莆仙片',
      '仙游',
      '城关',
    ]);
  });

  it('keeps the locked flavor id in the create payload', async () => {
    createPronunciation.mockResolvedValue({ id: 11, status: 'draft' });
    const page = createPage({
      draft: {
        ...PronunciationCreate.data().draft,
        ...validDraft(),
        reading_type: 'literary',
        usage_note: '文读',
        source_citation: '田野记录',
      },
    });

    await page.submit();

    expect(createPronunciation).toHaveBeenCalledWith(expect.objectContaining({
      flavor_id: 1,
      package_id: 2,
      dialect_id: 3,
      ipa: 'hiŋ²³',
      reading_type: 'literary',
    }));
    expect(page.$refs.form.validate).toHaveBeenCalledOnce();
    expect(notifySuccess).toHaveBeenCalledWith('读音已保存');
    expect(uni.navigateBack).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it.each([
    [{}, ['ipa', 'package_id', 'dialect_id']],
    [{ ipa: '  ' }, ['ipa', 'package_id', 'dialect_id']],
    [{ ...validDraft(), base_romanization: 'hing5' }, ['base_romanization', 'surface_romanization']],
    [{ ...validDraft(), surface_romanization: 'hing2' }, ['base_romanization', 'surface_romanization']],
    [{ ...validDraft(), sandhi_environment: '词中' }, ['sandhi_info']],
    [{ ...validDraft(), sandhi_environment: ' ' }, ['sandhi_info']],
    [{ ...validDraft(), base_romanization: ' ', surface_romanization: ' ' }, []],
    [{ ...validDraft(), base_romanization: 'hing5', surface_romanization: 'hing2', sandhi_environment: '词中' }, []],
  ])('maps pure validation to form rules without changing semantics: %j', async (draft, fields) => {
    const page = createPage({ draft });
    expect(Object.keys(validatePronunciationDraft(draft))).toEqual(fields);
    const result = await page.$refs.form.validate();
    expect(result === true ? [] : Object.keys(result).sort()).toEqual(
      fields.map((field) => (field === 'sandhi_info' ? 'sandhi_environment' : field)).sort(),
    );
  });

  it('shows loading and retry primitives and hides the form until options are ready', async () => {
    const wrapper = mount(PronunciationCreate, {
      global: { stubs: { PageShell: { template: '<div><slot /></div>' } } },
    });
    await wrapper.setData({ loading: true });
    expect(wrapper.findComponent(BaseLoading).exists()).toBe(true);
    expect(wrapper.findComponent(BaseForm).exists()).toBe(false);
    await wrapper.setData({ loading: false, loadError: '读音表单加载失败，请重试', flavorId: 1 });
    expect(wrapper.getComponent(EmptyState).props('actionText')).toBe('重试');
    getFlavor.mockResolvedValue({ id: 1, name: '行走', package_links: [] });
    listAllDialects.mockResolvedValue([]);
    await wrapper.getComponent(EmptyState).vm.$emit('action');
    await vi.waitFor(() => expect(wrapper.findComponent(BaseForm).exists()).toBe(true));
    expect(wrapper.findAllComponents(BaseField)).toHaveLength(6);
    expect(wrapper.find('input, textarea, button, picker').exists()).toBe(false);
    expect(wrapper.findAllComponents(BaseButton).at(-1).props('disabled')).toBe(true);
    wrapper.unmount();
  });

  it('rejects missing flavor ids without fetching or offering a broken retry', async () => {
    const page = createPage({ flavorId: 0, flavor: null });
    await page.loadOptions();
    expect(page.loadError).toBe('缺少义项参数');
    expect(page.loading).toBe(false);
    expect(getFlavor).not.toHaveBeenCalled();
    await page.submit();
    expect(createPronunciation).not.toHaveBeenCalled();
  });

  it.each(['flavor', 'dialects'])('recovers from %s option loading failures', async (failure) => {
    const page = createPage();
    getFlavor.mockResolvedValue({ id: 1, package_links: [] });
    listAllDialects.mockResolvedValue([]);
    (failure === 'flavor' ? getFlavor : listAllDialects).mockRejectedValueOnce(new Error('offline'));
    await page.loadOptions();
    expect(page.loadError).toBe('读音表单加载失败，请重试');
    expect(page.loading).toBe(false);
    await page.submit();
    expect(createPronunciation).not.toHaveBeenCalled();
    await page.loadOptions();
    expect(page.loadError).toBe('');
  });

  it('preserves valid choices on reload and clears choices outside the flavor links', async () => {
    const page = createPage();
    const links = [2, 4].map((id) => ({ mapping_type: 'primary', package: { id, text: `写法${id}` } }));
    listAllDialects.mockResolvedValue([]);
    getFlavor.mockResolvedValue({ id: 1, package_links: links });
    await page.loadOptions();
    expect(page.draft.package_id).toBeNull();
    page.onPackagePickerChange({ value: ['4'] });
    await page.loadOptions();
    expect(page.draft.package_id).toBe(4);
    page.flavorId = 2;
    getFlavor.mockResolvedValue({ id: 2, package_links: [links[0]] });
    await page.loadOptions();
    expect(getFlavor).toHaveBeenLastCalledWith(2);
    expect(page.draft.package_id).toBe(2);
    getFlavor.mockResolvedValue({ id: 2, package_links: [] });
    await page.loadOptions();
    expect(page.draft.package_id).toBeNull();
    page.openPackagePicker();
    expect(page.packagePickerVisible).toBe(false);
  });

  it('keeps picker ids numeric and clears their matching form errors', () => {
    const page = createPage({ fieldErrors: { package_id: '写法错误', dialect_id: '方言错误' } });
    page.onPackagePickerChange({ value: ['2'] });
    expect(page.draft.package_id).toBe(2);
    expect(page.packagePickerValue).toEqual([2]);
    page.onDialectCascadeChange({ detail: { value: '3', selectedOptions: [{ id: '3' }] } });
    expect(page.draft.dialect_id).toBe(3);
    expect(page.recentDialectIds).toEqual([3]);
    expect(page.fieldErrors).toEqual({});
    expect(page.$refs.form.clearValidate).toHaveBeenCalledWith(['package_id']);
    expect(page.$refs.form.clearValidate).toHaveBeenCalledWith(['dialect_id']);
    page.onDialectCascadeChange({ value: 1, selectedOptions: [{ id: 1, children: [{ id: 3 }] }] });
    expect(page.draft.dialect_id).toBe(3);
  });

  it('keeps dialect search and default/recent shortcuts', () => {
    const page = createPage();
    expect(page.filterDialectOption('仙游', { name: '城关', qualified_code: '闽.莆仙.仙游.城关' })).toBe(true);
    expect(page.filterDialectOption('闽语', { name: '城关' }, [{ name: '闽语' }])).toBe(true);
    expect(page.filterDialectOption('不存在', { name: '城关' })).toBe(false);
    page.selectDialectShortcut({ id: '4' });
    expect(page.draft.dialect_id).toBe(4);
    expect(page.dialectPickerVisible).toBe(false);
    expect(uni.setStorageSync).toHaveBeenCalledWith(expect.any(String), '[4]');
  });

  it('expands advanced errors before validation and never posts an invalid draft', async () => {
    const page = createPage({ draft: { ...validDraft(), base_romanization: 'hing5' } });
    page.$refs.form.validate.mockImplementation(async () => {
      expect(page.optionalOpen).toBe(true);
      expect(page.$nextTick).toHaveBeenCalled();
      return { base_romanization: [{ message: '变调前后形式必须成对填写' }] };
    });
    const pending = page.submit();
    await vi.advanceTimersByTimeAsync(300);
    expect(page.$refs.form.validate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    await pending;
    expect(createPronunciation).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    expect(notify).toHaveBeenCalledWith({ title: '请检查读音表单' });
  });

  it.each([false, undefined, {}])('posts only when BaseForm returns exactly true (%j)', async (result) => {
    const page = createPage({ draft: { ...PronunciationCreate.data().draft, ...validDraft() } });
    page.$refs.form.validate.mockResolvedValue(result);
    await page.submit();
    expect(createPronunciation).not.toHaveBeenCalled();
  });

  it('cleans every text field, retains sandhi evidence, and falls back to the locked flavor', async () => {
    globalThis.getCurrentPages.mockReturnValue([{}]);
    const page = createPage({ draft: {
      ...validDraft(), package_id: '2', dialect_id: '3', ipa: ' hiŋ²³ ',
      base_romanization: ' hing5 ', surface_romanization: ' hing2 ',
      sandhi_environment: ' 词中 ', reading_type: 'colloquial',
      usage_note: ' 白读 ', source_citation: ' 田野记录 ',
    } });
    await page.submit();
    expect(createPronunciation).toHaveBeenCalledWith({
      flavor_id: 1, package_id: 2, dialect_id: 3, ipa: 'hiŋ²³',
      base_romanization: 'hing5', surface_romanization: 'hing2',
      sandhi_info: { environment: '词中' }, reading_type: 'colloquial',
      usage_note: '白读', source_citation: '田野记录',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/flavors/details?id=1' });
    expect(uni.navigateBack).not.toHaveBeenCalled();
  });

  it('maps backend errors into form validation, expands advanced fields, and clears sandhi errors together', async () => {
    const page = createPage({ draft: { ...PronunciationCreate.data().draft, ...validDraft() } });
    createPronunciation.mockRejectedValue({ data: {
      ipa: { code: 'invalid', message: 'IPA 无效' },
      sandhi_info: { message: '变调证据不完整' },
      source_citation: { message: '请注明来源' },
      unknown: { message: '未知字段' },
    } });
    const pending = page.submit();
    await vi.advanceTimersByTimeAsync(350);
    await pending;
    expect(page.optionalOpen).toBe(true);
    expect(page.$refs.form.validate).toHaveBeenCalledTimes(2);
    expect(page.rules.sandhi_environment[0].validator()).toMatchObject({ message: '变调证据不完整' });
    expect(notify).not.toHaveBeenCalled();
    expect(uni.navigateBack).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    page.clearSandhiErrors();
    expect(page.fieldErrors.sandhi_info).toBeUndefined();
    expect(page.$refs.form.clearValidate).toHaveBeenCalledWith(['sandhi_environment']);
    expect(page.fieldErrors.source_citation).toBe('请注明来源');
  });

  it('shows one generic failure, keeps the draft and allows a retry', async () => {
    const page = createPage({ draft: { ...PronunciationCreate.data().draft, ...validDraft() } });
    createPronunciation.mockRejectedValueOnce({ message: '网络异常' }).mockResolvedValueOnce({ id: 1 });
    await page.submit();
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith({ title: '网络异常' });
    expect(page.draft.ipa).toBe('hiŋ²³');
    expect(page.submitting).toBe(false);
    await page.submit();
    expect(createPronunciation).toHaveBeenCalledTimes(2);
    expect(notifySuccess).toHaveBeenCalledOnce();
  });

  it('blocks repeat clicks during asynchronous validation and submission', async () => {
    const page = createPage({ draft: { ...PronunciationCreate.data().draft, ...validDraft() } });
    let finishValidation;
    let finishRequest;
    page.$refs.form.validate.mockReturnValue(new Promise((resolve) => { finishValidation = resolve; }));
    createPronunciation.mockReturnValue(new Promise((resolve) => { finishRequest = resolve; }));
    const pending = page.submit();
    await page.submit();
    expect(page.$refs.form.validate).toHaveBeenCalledOnce();
    finishValidation(true);
    await vi.advanceTimersByTimeAsync(0);
    await page.submit();
    expect(createPronunciation).toHaveBeenCalledOnce();
    finishRequest({ id: 1 });
    await pending;
    expect(page.submitting).toBe(false);
  });
});
