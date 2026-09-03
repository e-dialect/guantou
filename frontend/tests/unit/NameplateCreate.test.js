import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';

vi.mock('@/services/guantou', () => ({
  createNameplate: vi.fn(), getNameplate: vi.fn(), listAllDialects: vi.fn(),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/feedback', () => ({ notifySuccess: vi.fn() }));
vi.mock('@/services/navigation', () => ({
  goHome: vi.fn(), goNameplateDetail: vi.fn(), ROUTES: { home: '/' },
}));

const { createNameplate, getNameplate, listAllDialects } = await import('@/services/guantou');
const { requireAuth } = await import('@/services/authGuard');
const { notifySuccess } = await import('@/services/feedback');
const { goHome, goNameplateDetail } = await import('@/services/navigation');
const NameplateCreate = (await import('@/pages/nameplates/create.vue')).default;
const dialects = [
  { id: 3, name: '城关', qualified_code: '闽.莆仙.城关' },
  { id: 8, name: '游洋', qualified_code: '闽.莆仙.游洋' },
];

function createPage(overrides = {}) {
  const page = {
    ...NameplateCreate.data(), ...NameplateCreate.methods,
    canId: 11, dialects, contextLoaded: true, loading: false,
    ...overrides,
  };
  Object.entries(NameplateCreate.computed).forEach(([key, computed]) => {
    Object.defineProperty(page, key, { get: () => computed.call(page) });
  });
  page.$refs = { form: {
    clearValidate: vi.fn(),
    validate: vi.fn(async () => {
      const errors = Object.fromEntries(Object.entries(page.rules)
        .map(([field, rules]) => [field, rules[0].validator()])
        .filter(([, result]) => result !== true));
      return Object.keys(errors).length ? errors : true;
    }),
  } };
  return page;
}

describe('nameplate authoring', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAuth.mockReturnValue(true);
    listAllDialects.mockResolvedValue(dialects);
    getNameplate.mockResolvedValue({ id: 21, display_text: '刣', dialect: { id: 8 } });
    createNameplate.mockResolvedValue({ id: 31 });
  });

  it('preserves auth intent and never loads context for a guest', async () => {
    requireAuth.mockReturnValue(false);
    const page = createPage({ contextLoaded: false });
    await NameplateCreate.onLoad.call(page, { can_id: '11', reference_id: '21' });
    expect(requireAuth).toHaveBeenCalledWith('nameplate_create', { canId: 11, nameplateId: 21 });
    expect(listAllDialects).not.toHaveBeenCalled();
    expect(getNameplate).not.toHaveBeenCalled();
    await page.submit();
    expect(createNameplate).not.toHaveBeenCalled();
  });

  it('returns home without requesting context when the can id is absent', async () => {
    await NameplateCreate.onLoad.call(createPage(), {});
    expect(goHome).toHaveBeenCalledWith(true);
    expect(requireAuth).not.toHaveBeenCalled();
    expect(listAllDialects).not.toHaveBeenCalled();
  });

  it('loads the reference, prefills its dialect, and allows an override', async () => {
    const page = createPage();
    await NameplateCreate.onLoad.call(page, { can_id: '11', reference_id: '21' });
    expect(getNameplate).toHaveBeenCalledWith(21);
    expect(page.reference.display_text).toBe('刣');
    expect(page.selectedDialect.id).toBe(8);
    page.chooseDialect({ value: [3] });
    expect(page.selectedDialect.id).toBe(3);
    expect(page.reference.dialect.id).toBe(8);
    expect(page.form.text_content).toBe('');
  });

  it('uses the first available dialect without a matching reference and permits an empty list', async () => {
    const page = createPage();
    await page.loadContext();
    expect(getNameplate).not.toHaveBeenCalled();
    expect(page.selectedDialect.id).toBe(3);
    getNameplate.mockResolvedValue({ dialect: { id: 999 } });
    page.referenceId = 21;
    await page.loadContext();
    expect(page.selectedDialect.id).toBe(3);
    listAllDialects.mockResolvedValue([]);
    await page.loadContext();
    expect(page.selectedDialect).toBeNull();
    page.openDialectPicker();
    expect(page.dialectPickerVisible).toBe(false);
    page.form.text_content = '刣';
    await page.submit();
    expect(createNameplate).toHaveBeenCalledWith(11, expect.objectContaining({ dialect_id: undefined }));
  });

  it.each(['dialects', 'reference'])('recovers from a failed %s load without allowing a premature submit', async (kind) => {
    const page = createPage({ referenceId: 21 });
    const request = kind === 'dialects' ? listAllDialects : getNameplate;
    request.mockRejectedValueOnce({ message: '加载失败' });
    await page.loadContext();
    expect(page.loadError).toBe('加载失败');
    expect(page.loading).toBe(false);
    page.form.text_content = '刣';
    await page.submit();
    expect(createNameplate).not.toHaveBeenCalled();
    await page.loadContext();
    expect(page.contextLoaded).toBe(true);
    expect(page.loadError).toBe('');
    expect(page.form.text_content).toBe('刣');
    expect(page.reference.id).toBe(21);
  });

  it('shows the joint error on both fields and clears both when either changes', async () => {
    const page = createPage();
    page.form.text_content = ' \t ';
    page.form.pronunciation_text = '\n ';
    await page.submit();
    expect(page.$refs.form.validate).toHaveBeenCalledOnce();
    for (const rules of Object.values(page.rules)) {
      expect(rules[0].validator()).toMatchObject({ message: '写法或实际读音至少填写一项' });
    }
    expect(createNameplate).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    page.form.pronunciation_text = 'tai';
    page.clearClaimValidation();
    expect(page.$refs.form.clearValidate).toHaveBeenCalledWith(['text_content', 'pronunciation_text']);
    expect(page.rules.text_content[0].validator()).toBe(true);
    expect(page.rules.pronunciation_text[0].validator()).toBe(true);
  });

  it.each([
    ['刣', ''], ['', 'tai'], ['刣', 'tai'],
  ])('accepts writing %s / reading %s and replaces the route on success', async (writing, reading) => {
    const page = createPage();
    Object.assign(page.form, {
      text_content: ` ${writing} `, pronunciation_text: ` ${reading} `, definition: ' 宰杀 ',
    });
    await page.submit();
    expect(createNameplate).toHaveBeenCalledWith(11, {
      text_content: writing, pronunciation_text: reading, definition: '宰杀',
      dialect_id: 3, evidence_level: 1, source: { type: 'creator' },
    });
    expect(notifySuccess).toHaveBeenCalledWith('铭牌已发表');
    expect(goNameplateDetail).toHaveBeenCalledWith(31, {}, { replace: true });
    await page.submit();
    expect(createNameplate).toHaveBeenCalledOnce();
  });

  it.each(['creator', 'oral', 'fieldwork', 'book', 'article', 'archive', 'web', 'other'])(
    'preserves %s evidence mapping and filters blank source fields without trimming retained values',
    async (type) => {
      const page = createPage();
      page.form.text_content = '刣';
      page.form.source = { title: ' 方言志 ', attributed_to: ' \t', locator: '', note: ' p. 42 ' };
      page.chooseSource({ detail: { value: [type] } });
      await page.submit();
      expect(createNameplate).toHaveBeenCalledWith(11, expect.objectContaining({
        evidence_level: type === 'creator' ? 1 : 2,
        source: { type, title: ' 方言志 ', note: ' p. 42 ' },
      }));
    },
  );

  it('keeps input and permits retry after a rejected submission without a success or navigation', async () => {
    const page = createPage();
    page.form.text_content = ' 刣 ';
    createNameplate.mockRejectedValueOnce({ message: '网络异常，请重试' });
    await page.submit();
    expect(page.submitError).toBe('网络异常，请重试');
    expect(page.form.text_content).toBe(' 刣 ');
    expect(page.submitting).toBe(false);
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(goNameplateDetail).not.toHaveBeenCalled();
    await page.submit();
    expect(createNameplate).toHaveBeenCalledTimes(2);
    expect(page.submitError).toBe('');
  });

  it('blocks duplicate submission and picker changes throughout asynchronous validation and request', async () => {
    const page = createPage();
    page.form.text_content = '刣';
    let finishValidation;
    let finishRequest;
    page.$refs.form.validate.mockReturnValue(new Promise((resolve) => { finishValidation = resolve; }));
    createNameplate.mockReturnValue(new Promise((resolve) => { finishRequest = resolve; }));
    const pending = page.submit();
    await page.submit();
    expect(page.$refs.form.validate).toHaveBeenCalledOnce();
    finishValidation(true);
    await Promise.resolve();
    await page.submit();
    page.openDialectPicker();
    page.openSourcePicker();
    page.chooseDialect({ detail: { value: [8] } });
    page.chooseSource({ value: ['book'] });
    expect(page.dialectIndex).toBe(0);
    expect(page.sourceIndex).toBe(0);
    expect(page.dialectPickerVisible).toBe(false);
    expect(page.sourcePickerVisible).toBe(false);
    expect(createNameplate).toHaveBeenCalledOnce();
    finishRequest({ id: 31 });
    await pending;
    expect(page.submitting).toBe(false);
  });

  it('only submits when BaseForm returns exactly true', async () => {
    const page = createPage();
    page.form.text_content = '刣';
    page.$refs.form.validate.mockResolvedValue({ text_content: [] });
    await page.submit();
    expect(createNameplate).not.toHaveBeenCalled();
  });

  it('wires fields and picker confirmation/close without committing canceled or invalid choices', async () => {
    const wrapper = mount(NameplateCreate, {
      data: () => ({ loading: false, contextLoaded: true, dialects }),
      global: { stubs: { PageShell: { template: '<div><slot /></div>' } } },
    });
    expect(wrapper.findComponent(BaseForm).props('data')).toBe(wrapper.vm.form);
    expect(wrapper.findAllComponents(BaseField)).toHaveLength(7);
    const pickers = wrapper.findAllComponents(NameplateCreate.components.TPicker);
    // TDesign imports share a stub; select the two picker instances by their titles.
    const dialect = pickers.find((item) => item.vm.$attrs.title === '选择方言点');
    const source = pickers.find((item) => item.vm.$attrs.title === '选择来源类型');
    wrapper.vm.openDialectPicker();
    dialect.vm.$emit('close');
    wrapper.vm.openSourcePicker();
    source.vm.$emit('close');
    expect(wrapper.vm.dialectIndex).toBe(0);
    expect(wrapper.vm.sourceIndex).toBe(0);
    expect(wrapper.vm.dialectPickerVisible).toBe(false);
    expect(wrapper.vm.sourcePickerVisible).toBe(false);
    dialect.vm.$emit('change', { value: [8] });
    source.vm.$emit('change', { value: ['book'] });
    expect(wrapper.vm.selectedDialect.id).toBe(8);
    expect(wrapper.vm.sourceIndex).toBe(3);
    dialect.vm.$emit('change', { value: [999] });
    source.vm.$emit('change', { value: ['invalid'] });
    expect(wrapper.vm.selectedDialect.id).toBe(8);
    expect(wrapper.vm.sourceIndex).toBe(3);
    wrapper.unmount();
  });
});
