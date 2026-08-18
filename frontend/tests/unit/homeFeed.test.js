import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getCan: vi.fn(),
  getTodayCan: vi.fn(),
  listCans: vi.fn(),
}));

import { getCan, getTodayCan as getTodayCanApi, listCans } from '@/services/guantou';
import {
  getNameplatePreview,
  getTodayCan,
  listHomeFeed,
  resolveDefaultTab,
} from '@/services/homeFeed';

describe('homeFeed service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('listHomeFeed', () => {
    it('maps the four tabs to feed params with page_size 8', () => {
      listHomeFeed('dialect', 2);
      expect(listCans).toHaveBeenCalledWith({ feed: 'dialect', page: 2, page_size: 8 });

      listHomeFeed('following', 1);
      expect(listCans).toHaveBeenCalledWith({ feed: 'following', page: 1, page_size: 8 });

      listHomeFeed('recommended', 3);
      expect(listCans).toHaveBeenCalledWith({ feed: 'recommended', page: 3, page_size: 8 });

      listHomeFeed('unknown-tab', 1);
      expect(listCans).toHaveBeenCalledWith({ feed: 'recommended', page: 1, page_size: 8 });
    });
  });

  describe('getNameplatePreview', () => {
    it('prefers the list-provided previews and trims to 3', async () => {
      const can = {
        id: 5,
        nameplate_previews: [1, 2, 3, 4, 5].map((id) => ({ id })),
        nameplate_total: 5,
      };

      const result = await getNameplatePreview(5, can);

      expect(result.previews.map((plate) => plate.id)).toEqual([1, 2, 3]);
      expect(result.total).toBe(5);
      expect(getCan).not.toHaveBeenCalled();
    });

    it('does not issue a per-card fallback request when previews are absent', async () => {
      const result = await getNameplatePreview(9);

      expect(result).toEqual({ previews: [], total: 0 });
      expect(getCan).not.toHaveBeenCalled();
    });
  });

  describe('getTodayCan', () => {
    it('calls the official today endpoint and returns the card as-is', async () => {
      getTodayCanApi.mockResolvedValue({ id: 9 });

      const can = await getTodayCan();

      expect(can).toEqual({ id: 9 });
      expect(getTodayCanApi).toHaveBeenCalledTimes(1);
    });

    it('falls back to the first recommended can when the endpoint fails', async () => {
      getTodayCanApi.mockRejectedValue(new Error('today down'));
      listCans.mockResolvedValue({ results: [{ id: 42 }] });

      const can = await getTodayCan();

      expect(can).toEqual({ id: 42 });
      expect(listCans).toHaveBeenCalledWith({ feed: 'recommended', page: 1, page_size: 1 });
    });

    it('throws when neither the endpoint nor the recommended feed has a can', async () => {
      getTodayCanApi.mockRejectedValue(new Error('today down'));
      listCans.mockResolvedValue({ results: [] });

      await expect(getTodayCan()).rejects.toThrow('no today can available');
    });
  });

  describe('resolveDefaultTab', () => {
    it('returns dialect when a primary dialect is set', () => {
      expect(resolveDefaultTab({ primary_dialect: { id: 1 } })).toBe('dialect');
    });

    it('returns recommended for users without a primary dialect', () => {
      expect(resolveDefaultTab({})).toBe('recommended');
      expect(resolveDefaultTab(null)).toBe('recommended');
    });

    it('reads getApp globalData when no argument is given', () => {
      globalThis.getApp = vi.fn(() => ({
        globalData: { userInfo: { primary_dialect: { id: 2 } } },
      }));
      expect(resolveDefaultTab()).toBe('dialect');

      globalThis.getApp = vi.fn(() => ({ globalData: {} }));
      expect(resolveDefaultTab()).toBe('recommended');
    });
  });
});
