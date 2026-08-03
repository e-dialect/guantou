import { beforeEach, describe, expect, it, vi } from 'vitest';

const feedback = await import('@/services/feedback');

describe('feedback service', () => {
  beforeEach(() => {
    global.uni = {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('centralizes loading presentation', () => {
    feedback.showLoading('上传中……');
    feedback.hideLoading();

    expect(uni.showLoading).toHaveBeenCalledWith({
      title: '上传中……',
      mask: true,
    });
    expect(uni.hideLoading).toHaveBeenCalled();
  });

  it('maps API errors to user-facing messages', () => {
    feedback.notifyError({ statusCode: 403 });

    expect(uni.showToast).toHaveBeenCalledWith({
      title: '没有权限！',
      icon: 'error',
      duration: 2000,
      mask: false,
    });
  });

  it('keeps long toast text inside platform limits', () => {
    feedback.notify({ title: '这是一段非常非常非常非常非常非常长的错误信息' });

    expect(uni.showToast.mock.calls[0][0].title.length).toBeLessThanOrEqual(32);
  });
});
