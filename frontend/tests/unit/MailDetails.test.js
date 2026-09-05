import { flushPromises, mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { getMailDetails } from '@/services/mail';

vi.mock('@/services/mail', () => ({
  getMailDetails: vi.fn(),
}));

vi.mock('@/services/navigation', () => ({
  ROUTES: { home: '/' },
  goBack: vi.fn(),
  goMailSend: vi.fn(),
  openPage: vi.fn(),
}));

const { default: MailDetailsPage } = await import('@/pages/mails/details.vue');
const { goMailSend, openPage } = await import('@/services/navigation');

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
        BaseLoading: true,
        BaseButton: {
          props: ['text'],
          template: '<button @click="$emit(\'click\')">{{ text }}</button>',
        },
        EmptyState: {
          props: ['title', 'description', 'actionText'],
          template: '<div class="empty-state"><span>{{ title }}</span><span>{{ description }}</span><button @click="$emit(\'action\')">{{ actionText }}</button></div>',
        },
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

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(getMailDetails).toHaveBeenCalledWith(42);

    getMailDetails.mockResolvedValueOnce(mailResponse(42));
    await wrapper.find('.empty-state button').trigger('click');
    await flushPromises();

    expect(getMailDetails).toHaveBeenCalledTimes(2);
    expect(getMailDetails).toHaveBeenLastCalledWith(42);
  });

  it('offers the related content and a prefilled reply for a personal message', async () => {
    getMailDetails.mockResolvedValueOnce(mailResponse(12));
    const wrapper = mountPage({ id: '12' });
    await flushPromises();

    expect(wrapper.text()).toContain('这则消息关联到一个词条');
    expect(wrapper.vm.senderInitial).toBe('同');
    expect(wrapper.vm.canReply).toBe(true);

    wrapper.vm.openTarget();
    wrapper.vm.reply();

    expect(openPage).toHaveBeenCalledWith('/pages/entries/details?id=1');
    expect(goMailSend).toHaveBeenCalledWith(2, { title: '回复：你的词条获补证' });
  });

  it('does not show a reply action for a system message', async () => {
    const response = mailResponse(13);
    response.from.id = -1;
    response.from.nickname = '乡声集盒';
    response.target = null;
    getMailDetails.mockResolvedValueOnce(response);

    const wrapper = mountPage({ id: '13' });
    await flushPromises();

    expect(wrapper.vm.canReply).toBe(false);
    expect(wrapper.text()).not.toContain('回复这则消息');
  });
});
