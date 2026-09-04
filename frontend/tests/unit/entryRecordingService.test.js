import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const request = (await import('@/utils/request')).default;
const service = await import('@/services/entryRecording');

describe('Entry / Recording V2 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the entry-first and recording resources', async () => {
    request.get.mockResolvedValue({ results: [] });
    request.post.mockResolvedValue({ id: 8 });

    await service.listEntries({ search: '行' });
    await service.listRecordings({ entry_id: 3 });
    await service.createRecording({ audio_url: 'https://example.test/a.mp3' });

    expect(request.get).toHaveBeenNthCalledWith(1, '/entries/', { search: '行' }, true);
    expect(request.get).toHaveBeenNthCalledWith(2, '/recordings/', { entry_id: 3 }, true);
    expect(request.post).toHaveBeenCalledWith('/recordings/', {
      audio_url: 'https://example.test/a.mp3',
    });
  });

  it('keeps false filter values and omits only empty filters', () => {
    expect(service.buildEntrySearchParams({
      keyword: '行',
      dialectId: 11,
      dialectMatch: 'subtree',
      hasRecording: false,
      ipa: '',
      page: 2,
    })).toEqual({
      search: '行',
      dialect_id: 11,
      dialect_match: 'subtree',
      has_recording: false,
      page: 2,
    });
  });

  it('selects an accepted primary link without merging other interpretations', () => {
    const competing = { id: 2, role: 'competing', entry: { id: 9 } };
    const primary = { id: 1, role: 'primary', status: 'accepted', entry: { id: 7 } };
    const rejected = { id: 3, role: 'primary', status: 'rejected', entry: { id: 4 } };

    expect(service.primaryEntryLink({
      entry_links: [competing, rejected, primary],
    })).toBe(primary);
  });

  it('posts a scoped usage attestation', async () => {
    request.post.mockResolvedValue({ id: 10 });

    await service.createUsageAttestation('7', '11', ' 我这里常说 ');

    expect(request.post).toHaveBeenCalledWith('/usage-attestations/', {
      entry_id: 7,
      dialect_id: 11,
      note: '我这里常说',
    });
  });
});
