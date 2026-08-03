import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
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
      label: { text_content: 'khnee', definition: 'kneecap' },
    });

    expect(request.post).toHaveBeenCalledWith('/cans/', {
      concept_text: 'knee',
      initial_nameplate: {
        text_content: 'khnee',
        definition: 'kneecap',
      },
    });
  });

  it('submits flavor canning through the same can endpoint', async () => {
    request.post.mockResolvedValue({ id: 3 });

    await guantou.createCanForFlavor({
      can: { dialect: 1, audio_url: 'https://example.test/a.mp3' },
      flavorId: 9,
    });

    expect(request.post).toHaveBeenCalledWith('/cans/', {
      dialect: 1,
      audio_url: 'https://example.test/a.mp3',
      flavor: 9,
    });
  });

  it('uses the backend aggregate search endpoint', async () => {
    request.get.mockResolvedValue({ flavors: [], packages: [], cans: [] });

    await expect(guantou.searchGuantou('moon')).resolves.toEqual({
      flavors: [],
      packages: [],
      cans: [],
    });

    expect(request.get).toHaveBeenCalledWith('/search/', { search: 'moon' });
  });

  it('passes aggregate search options for suggestions', async () => {
    request.get.mockResolvedValue({ flavors: [], packages: [], cans: [] });

    await guantou.searchGuantou('moon', { limit: 5 });

    expect(request.get).toHaveBeenCalledWith('/search/', {
      search: 'moon',
      limit: 5,
    });
  });
});
