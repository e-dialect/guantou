import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

const { toLoginPage } = await import('@/routers/login');
const httpClient = await import('@/utils/httpClient');
const request = (await import('@/utils/request')).default;
const rawRequest = (await import('@/utils/rawRequest')).default;

function installUniMock() {
  global.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? 'stored-token' : '')),
    request: vi.fn(),
    uploadFile: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    showToast: vi.fn(),
  };
}

describe('httpClient compatibility wrappers', () => {
  beforeEach(() => {
    installUniMock();
    vi.useRealTimers();
  });

  it('request wrapper keeps token header and resolves JSON data', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { ok: true },
    });

    await expect(request.get('/api/cans/', { page: 1 })).resolves.toEqual({ ok: true });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: 'http://localhost:8000/api/cans/',
      data: { page: 1 },
      header: expect.objectContaining({
        'content-type': 'application/json',
        token: 'stored-token',
      }),
    }));
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '加载中', mask: true });
    expect(uni.hideLoading).toHaveBeenCalled();
  });

  it('request wrapper can opt out of auth headers', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { ok: true },
    });

    await expect(httpClient.request('GET', '/public', {}, {
      auth: false,
      loading: false,
    })).resolves.toEqual({ ok: true });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      header: {
        'content-type': 'application/json',
      },
    }));
    expect(uni.showLoading).not.toHaveBeenCalled();
  });

  it('request wrapper redirects on visible 401 errors', async () => {
    vi.useFakeTimers();
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: { msg: '未登录' },
    });

    await expect(request.get('/users/1')).rejects.toMatchObject({
      statusCode: 401,
      message: '未登录',
    });

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '未登录',
      icon: 'error',
    }));
    expect(toLoginPage).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(toLoginPage).toHaveBeenCalledTimes(1);
  });

  it('request noPrompt remains silent and does not redirect', async () => {
    vi.useFakeTimers();
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: { msg: '未登录' },
    });

    await expect(request.get('/users/1', null, true)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(uni.showToast).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('rawRequest remains silent and does not redirect on 401', async () => {
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: { msg: '用户名或密码错误' },
    });

    await expect(rawRequest.post('/login', { username: 'a' })).rejects.toMatchObject({
      statusCode: 401,
      message: '用户名或密码错误',
    });

    expect(uni.showToast).not.toHaveBeenCalled();
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('rawRequest supports explicit anonymous public requests', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { token: 'new-token' },
    });

    await expect(rawRequest.post('/login', { username: 'a' }, { auth: false })).resolves.toEqual({
      token: 'new-token',
    });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: 'http://localhost:8000/login',
      header: {
        'content-type': 'application/json',
      },
    }));
  });

  it('rawRequest still accepts legacy boolean silent argument', async () => {
    uni.request.mockResolvedValue({
      statusCode: 500,
      data: { msg: 'server failed' },
    });

    await expect(rawRequest.get('/legacy', null, false)).rejects.toMatchObject({
      statusCode: 500,
      message: 'server failed',
    });

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'server failed',
      icon: 'error',
    }));
  });

  it('upload uses the shared token and parses JSON response data', async () => {
    uni.uploadFile.mockResolvedValue({
      statusCode: 200,
      data: '{"url":"https://cos.example.test/file.mp3"}',
    });

    await expect(httpClient.upload('/tmp/audio.mp3')).resolves.toEqual({
      url: 'https://cos.example.test/file.mp3',
    });

    expect(uni.uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8000/files',
      filePath: '/tmp/audio.mp3',
      name: 'file',
      header: {
        token: 'stored-token',
      },
    }));
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '上传中……', mask: true });
  });

  it('upload falls back to raw data when response body is not JSON', async () => {
    uni.uploadFile.mockResolvedValue({
      statusCode: 200,
      data: 'not-json',
    });

    await expect(httpClient.upload('/tmp/audio.mp3')).resolves.toEqual({
      data: 'not-json',
    });
  });
});
