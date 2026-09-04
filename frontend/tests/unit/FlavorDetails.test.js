/* global globalThis */

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import FlavorDetails from '@/pages/flavors/details.vue';
import { getFlavor, listCans } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import { goCreateCan, goPronunciationCreate } from '@/services/navigation';

vi.mock('@/services/guantou', () => ({
  getFlavor: vi.fn(),
  listCans: vi.fn(),
}));
vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));
vi.mock('@/services/navigation', () => ({
  ROUTES: { home: '/pages/index/index' },
  goCanDetail: vi.fn(),
  goCreateCan: vi.fn(),
  goPackageDetail: vi.fn(),
  goPronunciationCreate: vi.fn(),
}));

const primaryFlavor = {
  id: 1,
  name: '月亮',
  definition: '夜空中的天然卫星',
  pronunciations: [{ id: 11 }],
  package_links: [],
};
const secondaryFlavor = {
  id: 2,
  name: '月亮',
  definition: '夜空中的天然卫星',
  pronunciations: [{ id: 22 }],
  package_links: [],
};

function pageContext(overrides = {}) {
  const context = {
    ...FlavorDetails.data(),
    ...FlavorDetails.methods,
    ...overrides,
  };
  Object.defineProperty(context, 'flavorIds', {
    get() {
      return FlavorDetails.computed.flavorIds.call(context);
    },
  });
  return context;
}

describe('flavor details aggregate identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      showActionSheet: vi.fn(),
      showToast: vi.fn(),
    };
  });

  afterEach(() => {
    delete globalThis.uni;
  });

  it('loads explicit matching identities and includes cans owned only by the second flavor', async () => {
    const page = pageContext({ id: 1, ids: [1, 2] });
    getFlavor
      .mockResolvedValueOnce(primaryFlavor)
      .mockResolvedValueOnce(secondaryFlavor);

    await page.refresh();
    listCans.mockImplementation(({ flavor_id: flavorId }) => Promise.resolve({
      results: [{ id: flavorId === 1 ? 101 : 202 }],
    }));
    const response = await page.fetchRelatedCans({ page: 1 });

    expect(page.flavor.flavor_ids).toEqual([1, 2]);
    expect(page.flavor.pronunciations).toEqual([{ id: 11 }, { id: 22 }]);
    expect(listCans).toHaveBeenNthCalledWith(1, { page: 1, flavor_id: 1 });
    expect(listCans).toHaveBeenNthCalledWith(2, { page: 1, flavor_id: 2 });
    expect(response.results.map((item) => item.id)).toEqual([101, 202]);
  });

  it('ignores an explicit id whose name and definition do not match the primary flavor', async () => {
    const page = pageContext({ id: 1, ids: [1, 9] });
    getFlavor
      .mockResolvedValueOnce(primaryFlavor)
      .mockResolvedValueOnce({
        ...secondaryFlavor, id: 9, name: '太阳',
      });

    await page.refresh();

    expect(page.flavor.flavor_ids).toEqual([1]);
  });

  it('asks for a concrete flavor before either aggregate create action', () => {
    const page = pageContext({
      id: 1,
      ids: [1, 2],
      flavor: { ...primaryFlavor, flavor_ids: [1, 2] },
    });

    page.toCreateForFlavor();
    let options = globalThis.uni.showActionSheet.mock.calls[0][0];
    options.success({ tapIndex: 1 });
    expect(requireAuth).toHaveBeenCalledWith('record_can', {
      page: 'flavor_detail',
      flavorId: 2,
      flavorName: '月亮',
    });
    expect(goCreateCan).toHaveBeenCalledWith({ flavor: 2, flavor_name: '月亮' });

    globalThis.uni.showActionSheet.mockClear();
    page.toCreatePronunciation();
    options = globalThis.uni.showActionSheet.mock.calls[0][0];
    options.success({ tapIndex: 1 });
    expect(requireAuth).toHaveBeenCalledWith('pronunciation_create', {
      page: 'flavor_detail',
      flavorId: 2,
    });
    expect(goPronunciationCreate).toHaveBeenCalledWith(2);
  });

  it('keeps every WeChat action sheet at six entries while paging seven flavors', () => {
    const flavorIds = [1, 2, 3, 4, 5, 6, 7];
    const page = pageContext({
      id: 1,
      ids: flavorIds,
      flavor: { ...primaryFlavor, flavor_ids: flavorIds },
    });
    const selections = [];

    page.selectFlavorTarget((id) => selections.push(id));
    const firstPage = globalThis.uni.showActionSheet.mock.calls[0][0];
    firstPage.success({ tapIndex: 4 });
    const secondPage = globalThis.uni.showActionSheet.mock.calls[1][0];
    secondPage.success({ tapIndex: 1 });

    expect(selections).toEqual([5]);
    expect(globalThis.uni.showActionSheet.mock.calls.every(
      ([options]) => options.itemList.length <= 6,
    )).toBe(true);
  });
});
