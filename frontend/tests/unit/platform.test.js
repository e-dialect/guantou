import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { isH5Runtime } from '@/services/platform';

describe('platform runtime detection', () => {
  beforeEach(() => {
    globalThis.uni = {
      getSystemInfoSync: vi.fn(() => ({ uniPlatform: 'mp-weixin' })),
    };
  });

  it('uses an existing system-info payload before querying uni-app again', () => {
    expect(isH5Runtime({ uniPlatform: 'web' })).toBe(true);
    expect(isH5Runtime({ uniPlatform: 'mp-weixin' })).toBe(false);
    expect(uni.getSystemInfoSync).not.toHaveBeenCalled();
  });

  it('detects H5 from runtime system info', () => {
    uni.getSystemInfoSync.mockReturnValue({ uniPlatform: 'web' });

    expect(isH5Runtime()).toBe(true);
  });

  it('fails closed when platform information is unavailable', () => {
    uni.getSystemInfoSync.mockImplementation(() => {
      throw new Error('system info unavailable');
    });

    expect(isH5Runtime()).toBe(false);
  });
});
