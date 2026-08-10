import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

const request = (await import('@/utils/request')).default;
const guantou = await import('@/services/guantou');

describe('guantou service canning helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits free canning without an initial nameplate when label is blank', async () => {
    request.post.mockResolvedValue({ id: 1 });

    await expect(guantou.createCanWithNameplate({
      can: { concept_text: 'knee', audio_url: 'https://example.test/a.mp3' },
      label: { text_content: '' },
    })).resolves.toEqual({ id: 1 });

    expect(request.post).toHaveBeenCalledWith('/cans/', {
      concept_text: 'knee',
      audio_url: 'https://example.test/a.mp3',
      initial_nameplate: undefined,
    });
  });

  it('submits free canning with an initial nameplate atomically', async () => {
    request.post.mockResolvedValue({ id: 2 });

    await guantou.createCanWithNameplate({
      can: { concept_text: 'knee' },
      label: {
        text_content: 'khnee',
        definition: 'kneecap',
        source: { type: 'oral' },
      },
    });

    expect(request.post).toHaveBeenCalledWith('/cans/', {
      concept_text: 'knee',
      initial_nameplate: {
        text_content: 'khnee',
        definition: 'kneecap',
        pronunciation_text: '',
        source: { type: 'oral' },
      },
    });
  });

  it('submits flavor canning through the same can endpoint', async () => {
    request.post.mockResolvedValue({ id: 3 });

    await guantou.createCanForFlavor({
      can: {
        submitted_dialect_id: 1,
        concept_text: 'walk',
        audio_url: 'https://example.test/a.mp3',
      },
      flavorId: 9,
    });

    expect(request.post).toHaveBeenCalledWith('/cans/', {
      submitted_dialect_id: 1,
      concept_text: 'walk',
      audio_url: 'https://example.test/a.mp3',
      initial_nameplate: {
        flavor_id: 9,
        dialect_id: 1,
        source: { type: 'creator' },
      },
    });
  });

  it('uses the backend aggregate search endpoint', async () => {
    request.get.mockResolvedValue({ flavors: [], packages: [], cans: [] });

    await expect(guantou.searchGuantou('moon')).resolves.toEqual({
      flavors: [],
      packages: [],
      cans: [],
    });

    expect(request.get).toHaveBeenCalledWith('/search/', { q: 'moon' }, true);
  });

  it('passes aggregate search options for suggestions', async () => {
    request.get.mockResolvedValue({ flavors: [], packages: [], cans: [] });

    await guantou.suggestGuantou('moon', { limit: 5 });

    expect(request.get).toHaveBeenCalledWith(
      '/search/suggest/',
      { q: 'moon', limit: 5 },
      true,
    );
  });

  it('loads hot search terms silently', async () => {
    request.get.mockResolvedValue([{ keyword: '月亮', rank: 1 }]);

    await expect(guantou.listHotSearches({ limit: 8 })).resolves.toEqual([
      { keyword: '月亮', rank: 1 },
    ]);

    expect(request.get).toHaveBeenCalledWith('/search/hot/', { limit: 8 }, true);
  });

  it('transitions cans through the dedicated endpoint without global prompts', async () => {
    request.post.mockResolvedValue({ id: 4, status: 'tentative' });

    await expect(guantou.transitionCan(4, 'submit', '本人确认')).resolves.toEqual({
      id: 4,
      status: 'tentative',
    });

    expect(request.post).toHaveBeenCalledWith(
      '/cans/4/transition/',
      { action: 'submit', reason: '本人确认' },
      true,
    );
  });

  it('creates pronunciations and updates shelves without global prompts', async () => {
    request.post.mockResolvedValue({ id: 8, status: 'draft' });
    request.patch.mockResolvedValue({ id: 5, flavor_ids: [2] });

    await guantou.createPronunciation({ flavor_id: 1, package_id: 2, dialect_id: 3, ipa: 'hiŋ' });
    await guantou.updateShelf(5, { flavor_ids: [2] });

    expect(request.post).toHaveBeenCalledWith(
      '/pronunciations/',
      { flavor_id: 1, package_id: 2, dialect_id: 3, ipa: 'hiŋ' },
      true,
    );
    expect(request.patch).toHaveBeenCalledWith(
      '/shelves/5/',
      { flavor_ids: [2] },
      true,
    );
  });

  it('creates and supports nameplates through first-class endpoints', async () => {
    request.post.mockResolvedValue({ id: 4 });
    request.put.mockResolvedValue({ id: 4, weight: 1 });

    await guantou.createNameplate(3, { text_content: '行', source: { type: 'book' } });
    await guantou.supportNameplate(4);

    expect(request.post).toHaveBeenCalledWith('/nameplates/', {
      can_id: 3,
      text_content: '行',
      source: { type: 'book' },
    });
    expect(request.put).toHaveBeenCalledWith('/nameplates/4/support/');
  });

  it('loads dialects depth-first using explicit backend ordering', async () => {
    request.get
      .mockResolvedValueOnce({
        next: null,
        results: [{ id: 1, qualified_code: '闽', sort_order: 1, children_count: 1 }],
      })
      .mockResolvedValueOnce({
        next: null,
        results: [{ id: 2, qualified_code: '闽.莆仙', sort_order: 1, children_count: 0 }],
      });

    await expect(guantou.listAllDialects()).resolves.toEqual([
      expect.objectContaining({ id: 1, depth: 0 }),
      expect.objectContaining({ id: 2, depth: 1 }),
    ]);
    expect(request.get).toHaveBeenNthCalledWith(2, '/dialects/', {
      parent_id: 1,
      page: 1,
      page_size: 100,
    });
  });

  it('consumes every page before recursively loading dialect children', async () => {
    request.get
      .mockResolvedValueOnce({
        next: 'http://localhost:8000/dialects/?page=2&page_size=100',
        results: [{ id: 1, qualified_code: '闽', sort_order: 10, children_count: 1 }],
      })
      .mockResolvedValueOnce({
        next: null,
        results: [{ id: 3, qualified_code: '粤', sort_order: 20, children_count: 0 }],
      })
      .mockResolvedValueOnce({
        next: null,
        results: [{ id: 2, qualified_code: '闽.莆仙', sort_order: 10, children_count: 0 }],
      });

    await expect(guantou.listAllDialects()).resolves.toEqual([
      expect.objectContaining({ id: 1, depth: 0 }),
      expect.objectContaining({ id: 2, depth: 1 }),
      expect.objectContaining({ id: 3, depth: 0 }),
    ]);
    expect(request.get).toHaveBeenNthCalledWith(2, '/dialects/', {
      page: 2,
      page_size: 100,
    });
    expect(request.get).toHaveBeenNthCalledWith(3, '/dialects/', {
      parent_id: 1,
      page: 1,
      page_size: 100,
    });
  });
});
