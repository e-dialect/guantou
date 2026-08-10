import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/rawRequest', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/login', () => ({
  afterLogin: vi.fn(),
}));

import { afterLogin } from '@/services/login';
import {
  isValidPhone,
  loginWithPhone,
  normalizePhone,
  requestPhoneCode,
} from '@/services/phoneAuth';
import rawRequest from '@/utils/rawRequest';

describe('phone authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes common phone formatting and rejects invalid numbers', () => {
    expect(normalizePhone('138 0000-0000')).toBe('13800000000');
    expect(isValidPhone('138 0000-0000')).toBe(true);
    expect(isValidPhone('23800000000')).toBe(false);
  });

  it('requests a demo code without an auth token', async () => {
    rawRequest.post.mockResolvedValue({ demo_code: '123456', retry_after: 60 });

    await expect(requestPhoneCode('138 0000 0000')).resolves.toMatchObject({
      demo_code: '123456',
    });
    expect(rawRequest.post).toHaveBeenCalledWith('/users/phone-code', {
      phone: '13800000000',
    }, { auth: false });
  });

  it('logs in and preserves new-user onboarding semantics', async () => {
    rawRequest.post.mockResolvedValue({
      id: 7,
      token: 'token',
      is_new: true,
    });

    await loginWithPhone('13800000000', '123456');

    expect(rawRequest.post).toHaveBeenCalledWith('/login/phone', {
      phone: '13800000000',
      code: '123456',
    }, { auth: false });
    expect(afterLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), {
      isNew: true,
    });
  });

  it('does not call the API for invalid input', async () => {
    await expect(requestPhoneCode('123')).rejects.toThrow('请输入有效的 11 位手机号');
    await expect(loginWithPhone('13800000000', '')).rejects.toThrow('请输入验证码');
    expect(rawRequest.post).not.toHaveBeenCalled();
  });
});
