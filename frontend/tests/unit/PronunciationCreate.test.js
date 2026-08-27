import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  createPronunciation: vi.fn(),
  getFlavor: vi.fn(),
  listAllDialects: vi.fn(),
}));

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

describe('pronunciation authoring flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
      navigateBack: vi.fn(),
      setStorageSync: vi.fn(),
      showToast: vi.fn(),
    };
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
    const page = {
      ...PronunciationCreate.data(),
      ...PronunciationCreate.methods,
      flavorId: 1,
    };

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
    const page = {
      ...PronunciationCreate.data(),
      ...PronunciationCreate.methods,
      flavorId: 1,
      draft: {
        ...PronunciationCreate.data().draft,
        ...validDraft(),
        reading_type: 'literary',
        usage_note: '文读',
        source_citation: '田野记录',
      },
    };

    await page.submit();

    expect(createPronunciation).toHaveBeenCalledWith(expect.objectContaining({
      flavor_id: 1,
      package_id: 2,
      dialect_id: 3,
      ipa: 'hiŋ²³',
      reading_type: 'literary',
    }));
  });
});
