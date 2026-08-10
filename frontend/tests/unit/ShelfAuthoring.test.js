import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  createShelf: vi.fn(),
  getShelf: vi.fn(),
  listCans: vi.fn(),
  listFlavors: vi.fn(),
  listShelves: vi.fn(),
  updateShelf: vi.fn(),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));

const { createShelf, getShelf, updateShelf } = await import('@/services/guantou');
const ShelfIndexModule = await import('@/pages/shelves/index.vue');
const ShelfIndex = ShelfIndexModule.default;
const { createShelfSlug } = ShelfIndexModule;
const ShelfDetailsModule = await import('@/pages/shelves/details.vue');
const ShelfDetails = ShelfDetailsModule.default;
const { shelfCollectionIds } = ShelfDetailsModule;

describe('shelf authoring flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn(() => 7),
      navigateTo: vi.fn(),
      showToast: vi.fn(),
    };
    globalThis.getApp = () => ({
      globalData: { userInfo: { id: 7, is_staff: false } },
    });
  });

  it('generates client-owned slugs and merges collection ids idempotently', () => {
    expect(createShelfSlug(7, 1000, 0.5)).toMatch(/^user-7-rs-[a-z0-9]+$/);
    expect(shelfCollectionIds([{ id: 1 }, { id: 2 }], 2, 'add')).toEqual([1, 2]);
    expect(shelfCollectionIds([{ id: 1 }, { id: 2 }], 3, 'add')).toEqual([1, 2, 3]);
    expect(shelfCollectionIds([{ id: 1 }, { id: 2 }], 1, 'remove')).toEqual([2]);
  });

  it('shows the editor only to the creator or staff', () => {
    const canEdit = ShelfDetails.computed.canEdit;
    const shelf = { creator: { id: 7 } };
    expect(canEdit.call({ shelf, currentUser: { id: 7, is_staff: false } })).toBe(true);
    expect(canEdit.call({ shelf, currentUser: { id: 8, is_staff: true } })).toBe(true);
    expect(canEdit.call({ shelf, currentUser: { id: 8, is_staff: false } })).toBe(false);
  });

  it('creates ordinary-user shelves with a client-generated slug and fixed type', async () => {
    createShelf.mockResolvedValue({
      id: 5,
      title: '乡音路线',
      description: '沿途收集',
      shelf_type: 'user',
      flavors: [],
      cans: [],
    });
    const page = {
      ...ShelfIndex.data(),
      ...ShelfIndex.methods,
      draft: { title: ' 乡音路线 ', description: ' 沿途收集 ' },
    };

    await page.submitCreate();

    expect(createShelf).toHaveBeenCalledWith(expect.objectContaining({
      title: '乡音路线',
      description: '沿途收集',
      shelf_type: 'user',
      slug: expect.stringMatching(/^user-7-/),
    }));
    expect(page.shelves[0].id).toBe(5);
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/shelves/details?id=5' });
  });

  it('reads the latest shelf before applying full-replacement PATCH semantics', async () => {
    getShelf.mockResolvedValue({
      id: 5,
      flavors: [{ id: 1 }, { id: 2 }],
      cans: [{ id: 9 }],
    });
    updateShelf.mockResolvedValue({
      id: 5,
      flavors: [{ id: 1 }, { id: 2 }, { id: 3 }],
      cans: [{ id: 9 }],
    });
    const page = {
      ...ShelfDetails.data(),
      ...ShelfDetails.methods,
      id: 5,
      canEdit: true,
      shelf: { flavors: [{ id: 1 }], cans: [{ id: 9 }] },
    };

    await page.changeContent('flavor', 3, 'add');

    expect(getShelf).toHaveBeenCalledWith(5);
    expect(updateShelf).toHaveBeenCalledWith(5, { flavor_ids: [1, 2, 3] });
    expect(page.shelf.flavors.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});
