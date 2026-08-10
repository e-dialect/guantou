import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mail', () => ({
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

import NotificationCenter from '@/pages/mails/index.vue';
import { listNotifications, markNotificationsRead } from '@/services/mail';

const notification = {
  id: 12,
  title: '罐头有新评论',
  content: '很有意思',
  unread: true,
  time: '2026-08-11 10:00:00',
  from: { avatar: '/avatar.png', nickname: '乡音朋友' },
  target: { type: 'can', id: 9, url: '/pages/cans/details?id=9' },
};

function mountCenter() {
  return mount(NotificationCenter, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot name="before" /><slot /></main>' },
        'scroll-view': { template: '<div><slot /></div>' },
        'uni-load-more': true,
      },
    },
  });
}

describe('notification center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotifications.mockResolvedValue({
      notifications: [notification],
      page: 1,
      pages: 1,
      total: 1,
    });
    markNotificationsRead.mockResolvedValue({});
    globalThis.uni = { navigateTo: vi.fn(), showToast: vi.fn() };
  });

  it('loads notifications with the selected unread filter', async () => {
    const wrapper = mountCenter();
    wrapper.vm.filter = 'unread';
    await wrapper.vm.refresh();

    expect(listNotifications).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      unread: true,
    });
    expect(wrapper.text()).toContain('罐头有新评论');
  });

  it('marks one notification read before opening its target', async () => {
    const wrapper = mountCenter();
    wrapper.vm.notifications = [notification];

    await wrapper.vm.openNotification(notification);

    expect(markNotificationsRead).toHaveBeenCalledWith([12]);
    expect(wrapper.vm.notifications[0].unread).toBe(false);
    expect(notification.unread).toBe(true);
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/details?id=9',
    });
  });

  it('marks the loaded collection read in one request', async () => {
    const wrapper = mountCenter();
    wrapper.vm.notifications = [notification];

    await wrapper.vm.markAllRead();
    await flushPromises();

    expect(markNotificationsRead).toHaveBeenCalledWith();
    expect(wrapper.vm.notifications[0].unread).toBe(false);
  });
});
