import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { notify } from '@/services/feedback';
import { isWechatMiniProgram } from '@/services/platform';
import { trackProductEvent } from '@/services/productAnalytics';
import {
  CAPABILITIES,
  compiledCapabilities,
  ensureCapability,
  getCapabilityStatus,
  hydrateCapabilities,
  resetCapabilitiesForTests,
} from '@/services/capabilities';
import { request } from '@/utils/httpClient';
import manifest from '@/manifest.json';
import pages from '@/pages.json';

vi.mock('@/services/platform', () => ({
  isWechatMiniProgram: vi.fn(() => false),
}));

vi.mock('@/services/feedback', () => ({ notify: vi.fn() }));
vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: { CAPABILITY_DEGRADED: 'capability_degraded' },
  trackProductEvent: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('@/utils/httpClient', () => ({
  request: vi.fn(),
}));

describe('capability matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCapabilitiesForTests();
    isWechatMiniProgram.mockReturnValue(false);
    globalThis.uni = {
      getStorageSync: vi.fn(() => null),
      setStorageSync: vi.fn(),
    };
  });

  it('defines WeChat auth as a compiled target capability', () => {
    expect(compiledCapabilities()[CAPABILITIES.WECHAT_AUTH]).toBe(false);
    isWechatMiniProgram.mockReturnValue(true);
    expect(compiledCapabilities()[CAPABILITIES.WECHAT_AUTH]).toBe(true);
  });

  it('does not declare WeChat location or background location permissions', () => {
    expect(manifest['mp-weixin'].permission?.['scope.userLocation']).toBeUndefined();
    expect(manifest['mp-weixin'].requiredBackgroundModes).toEqual(['audio']);
    expect(pages.requiredBackgroundModes).toEqual(['audio']);
    expect(JSON.stringify(manifest['mp-weixin'])).not.toContain('location');
  });

  it('intersects compiled capabilities with remote switches', async () => {
    request.mockResolvedValue({
      capabilities: {
        recording: false,
        wechat_auth: true,
      },
    });

    await hydrateCapabilities();

    expect(getCapabilityStatus(CAPABILITIES.RECORDING)).toMatchObject({
      compiled: true,
      remotely_enabled: false,
      enabled: false,
      reason: 'disabled_remotely',
    });
    expect(getCapabilityStatus(CAPABILITIES.WECHAT_AUTH)).toMatchObject({
      compiled: false,
      remotely_enabled: true,
      enabled: false,
      reason: 'not_compiled',
    });
  });

  it('uses a fresh cached kill switch when the network is unavailable', async () => {
    globalThis.uni.getStorageSync.mockReturnValue({
      saved_at: Date.now(),
      capabilities: { curation_workbench: false },
    });
    request.mockRejectedValue(new Error('offline'));

    await hydrateCapabilities();

    expect(getCapabilityStatus(CAPABILITIES.CURATION_WORKBENCH)).toMatchObject({
      enabled: false,
      config_source: 'cache',
    });
  });

  it('explains degradation and records only capability and reason', async () => {
    request.mockResolvedValue({ capabilities: { recording: false } });
    await hydrateCapabilities();

    expect(ensureCapability(CAPABILITIES.RECORDING, 'record')).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      title: '这项功能正在维护，请稍后再试',
    }));
    expect(trackProductEvent).toHaveBeenCalledWith('capability_degraded', {
      surface: 'record',
      result: 'unavailable',
      metadata: { capability: 'recording', reason: 'disabled_remotely' },
    });
  });
});
