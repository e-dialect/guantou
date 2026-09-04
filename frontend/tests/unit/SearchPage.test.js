import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(async () => []),
}));

const request = (await import('@/utils/request')).default;
const SearchPage = (await import('@/pages/search.vue')).default;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pageContext() {
  return {
    ...SearchPage.data(),
    ...SearchPage.methods,
  };
}

describe('entry-first search page orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps same-writing results as separate entries', async () => {
    const page = pageContext();
    page.filters.keyword = '行';
    request.get.mockResolvedValue({
      count: 2,
      next: null,
      results: [
        { id: 1, display_writing: '行', summary: '步行' },
        { id: 2, display_writing: '行', summary: '银行用字' },
      ],
    });

    await page.search();

    expect(request.get).toHaveBeenCalledWith('/entries/', expect.objectContaining({
      search: '行',
      page: 1,
      page_size: 20,
    }), true);
    expect(page.entries.map((entry) => entry.id)).toEqual([1, 2]);
    expect(page.total).toBe(2);
  });

  it('preserves false and exact values in advanced filters', () => {
    const page = pageContext();
    page.filters.dialectId = 23;
    page.filters.dialectMatch = 'exact';
    page.filters.hasRecording = false;
    page.filters.ipa = 'hiŋ';

    expect(page.requestParams(3)).toMatchObject({
      dialect_id: 23,
      dialect_match: 'exact',
      has_recording: false,
      ipa: 'hiŋ',
      page: 3,
    });
  });

  it('discards a stale search response after a newer query wins', async () => {
    const first = deferred();
    const second = deferred();
    request.get
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const page = pageContext();

    page.filters.keyword = '月';
    const firstRequest = page.search();
    page.filters.keyword = '月亮';
    const secondRequest = page.search();
    second.resolve({ results: [{ id: 2, display_writing: '月亮' }], count: 1 });
    await secondRequest;
    first.resolve({ results: [{ id: 1, display_writing: '月' }], count: 1 });
    await firstRequest;

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].display_writing).toBe('月亮');
  });
});
