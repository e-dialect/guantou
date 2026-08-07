import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
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

    expect(request.get).toHaveBeenCalledWith('/search/', { q: 'moon' });
  });

  it('passes aggregate search options for suggestions', async () => {
    request.get.mockResolvedValue({ flavors: [], packages: [], cans: [] });

    await guantou.suggestGuantou('moon', { limit: 5 });

    expect(request.get).toHaveBeenCalledWith('/search/suggest/', {
      q: 'moon',
      limit: 5,
    });
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
});
