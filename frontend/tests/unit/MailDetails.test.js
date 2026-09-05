import { flushPromises, mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { getMailDetails } from '@/services/mail';

vi.mock('@/services/mail', () => ({
  getMailDetails: vi.fn(),
}));

const { default: MailDetailsPage } = await import('@/pages/mails/details.vue');

function mailResponse(id) {
  return {
    id,
    from: { id: 2, nickname: '同乡小李', avatar: '' },
    to: { id: 1, nickname: '演示用户', avatar: '' },
    time: '2026-08-31 10:00:00',
    title: '你的词条获补证',
    content: '同乡小李补充了词条证据',
    unread: true,
    public: true,
    target: { type: 'entry', id: 1, url: '/pages/entries/details?id=1' },
  };
}

function mountPage(options) {
  const wrapper = mount(MailDetailsPage, {
    global: {
      stubs: {
        PageShell: { template: '<div><slot /></div>' },
      },
    },
  });
  wrapper.vm.$options.onLoad.call(wrapper.vm, options);
  return wrapper;
}

describe('mail details page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {};
  });

  it('retries with the original route id after the first request fails', async () => {
    getMailDetails.mockRejectedValueOnce(new Error('加载失败'));
    const wrapper = mountPage({ id: '42' });
    await flushPromises();

    expect(wrapper.find('.state.error').exists()).toBe(true);
    expect(getMailDetails).toHaveBeenCalledWith(42);

    getMailDetails.mockResolvedValueOnce(mailResponse(42));
    await wrapper.find('.state.error').trigger('tap');
    await flushPromises();

    expect(getMailDetails).toHaveBeenCalledTimes(2);
    expect(getMailDetails).toHaveBeenLastCalledWith(42);
  });
});
