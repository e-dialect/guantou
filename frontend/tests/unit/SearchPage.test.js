import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getNameplate: vi.fn(),
  listHotSearches: vi.fn(),
  searchGuantou: vi.fn(),
  suggestGuantou: vi.fn(),
}));

const {
  listHotSearches,
  suggestGuantou,
} = await import('@/services/guantou');
const SearchPage = (await import('@/pages/search.vue')).default;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pageContext() {
  const data = SearchPage.data();
  return {
    ...data,
    ...SearchPage.methods,
  };
}

describe('search page orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads real hot terms once and silently falls back to an empty list', async () => {
    const page = pageContext();
    listHotSearches.mockResolvedValueOnce([
      { keyword: '月亮', rank: 1 },
      { keyword: '行', rank: 2 },
    ]);

    await page.loadHotTags();
    await page.loadHotTags();

    expect(page.hotTags).toEqual(['月亮', '行']);
    expect(listHotSearches).toHaveBeenCalledTimes(1);

    const failedPage = pageContext();
    listHotSearches.mockRejectedValueOnce(new Error('offline'));
    await failedPage.loadHotTags();
    expect(failedPage.hotTags).toEqual([]);
  });

  it('discards stale suggestion responses after faster input wins', async () => {
    const first = deferred();
    const second = deferred();
    suggestGuantou
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const page = pageContext();

    const firstRequest = page.suggest('月');
    const secondRequest = page.suggest('月亮');
    second.resolve({
      suggestions: [{ type: 'flavor', id: 2, text: '月亮', sub: '义项' }],
    });
    await secondRequest;
    first.resolve({
      suggestions: [{ type: 'package', id: 1, text: '月', sub: '写法' }],
    });
    await firstRequest;

    expect(page.suggestions).toHaveLength(1);
    expect(page.suggestions[0]).toMatchObject({ title: '月亮', scope: 'flavors' });
  });
});
