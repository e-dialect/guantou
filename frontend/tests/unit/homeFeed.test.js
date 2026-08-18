import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getCan: vi.fn(),
  getDiscovery: vi.fn(),
  listCans: vi.fn(),
}));

import { getCan, getDiscovery, listCans } from '@/services/guantou';
import {
  getNameplatePreview,
  getTodayCan,
  listHomeFeed,
  resolveDefaultTab,
} from '@/services/homeFeed';

function setupStorage() {
  const store = {};
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : '')),
    setStorageSync: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeStorageSync: vi.fn((key) => {
      delete store[key];
    }),
  };
  globalThis.getApp = vi.fn(() => ({ globalData: {} }));
  return store;
}

function localDaySerial(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

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
    it('rotates deterministically by local day serial and caches per day', async () => {
      const store = setupStorage();
      const hotCans = [{ id: 1 }, { id: 2 }, { id: 3 }];
      getDiscovery.mockResolvedValue({ hot_cans: hotCans });

      const first = await getTodayCan();
      const daySerial = localDaySerial();
      expect(first).toEqual(hotCans[daySerial % hotCans.length]);
      expect(store.home_today_can).toBeTruthy();

      // 同一天内直接命中缓存
      const again = await getTodayCan();
      expect(again).toEqual(first);
      expect(getDiscovery).toHaveBeenCalledTimes(1);
    });

    it('picks a different can on the next day', async () => {
      setupStorage();
      const hotCans = [{ id: 1 }, { id: 2 }];
      getDiscovery.mockResolvedValue({ hot_cans: hotCans });
      const expectedToday = hotCans[localDaySerial() % 2];

      const first = await getTodayCan();
      expect(first).toEqual(expectedToday);

      // 模拟跨天：清掉当日缓存，并把系统时钟拨到第二天
      uni.removeStorageSync('home_today_can');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      vi.useFakeTimers();
      vi.setSystemTime(tomorrow);
      const expectedTomorrow = hotCans[localDaySerial(tomorrow) % 2];
      const next = await getTodayCan();
      expect(next).toEqual(expectedTomorrow);
      expect(next).not.toEqual(first);
    });

    it('rotates on local midnight and stays stable within a local day', async () => {
      setupStorage();
      const hotCans = [{ id: 1 }, { id: 2 }];
      getDiscovery.mockResolvedValue({ hot_cans: hotCans });

      // 以本地日历日为口径：本地午夜刚过即应轮换，同一天内保持稳定。
      const localTime = (dayOffset, hours) => {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        date.setHours(hours, 30, 0, 0);
        return date;
      };

      vi.useFakeTimers();
      vi.setSystemTime(localTime(0, 0)); // 今天本地 00:30
      const earlyMorning = await getTodayCan();

      // 拨到当天本地正午：本地日期未变，序号也不应变化。
      uni.removeStorageSync('home_today_can');
      vi.setSystemTime(localTime(0, 12));
      const noon = await getTodayCan();
      expect(noon).toEqual(earlyMorning);

      // 跨到下一个本地日（午夜刚过），序号必须轮换。
      uni.removeStorageSync('home_today_can');
      vi.setSystemTime(localTime(1, 0));
      const nextDay = await getTodayCan();
      expect(nextDay).not.toEqual(earlyMorning);
    });

    it('falls back to the first recommended can when discovery fails', async () => {
      setupStorage();
      getDiscovery.mockRejectedValue(new Error('discovery down'));
      listCans.mockResolvedValue({ results: [{ id: 42 }] });

      const can = await getTodayCan();

      expect(can).toEqual({ id: 42 });
      expect(listCans).toHaveBeenCalledWith({ feed: 'recommended', page: 1, page_size: 1 });
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
