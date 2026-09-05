import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { getMyContributionHistory } from '@/services/entryRecording';
import { notify, notifySuccess } from '@/services/feedback';
import ThemeAcquirePage from '@/pages/users/theme-acquire.vue';
import ThemeEventPage from '@/pages/users/theme-event.vue';
import ThemeMemberPage from '@/pages/users/theme-member.vue';
import {
  getMemberStatus,
  isOwned,
  setCreatorProgress,
  THEME_ACCESS_FOOTER,
} from '@/services/themeCenter';

vi.mock('@/services/entryRecording', () => ({
  getMyContributionHistory: vi.fn(),
}));

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

function memoryStore() {
  const store = {};
  uni.getStorageSync.mockImplementation((key) => store[key] ?? '');
  uni.setStorageSync.mockImplementation((key, value) => {
    store[key] = value;
  });
  return store;
}

describe('theme acquire, member, and event pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      navigateTo: vi.fn(),
    };
    memoryStore();
  });

  function stubs() {
    return {
      PageShell: {
        name: 'PageShell',
        props: ['title'],
        template: '<main><h1>{{ title }}</h1><slot /></main>',
      },
    };
  }

  it('lists member, event, creator, and dialect welfare entries', async () => {
    const wrapper = mount(ThemeAcquirePage, {
      global: { stubs: stubs() },
    });
    expect(wrapper.text()).toContain('装扮获取');
    expect(wrapper.text()).toContain('按真实资格找到获取路径');
    expect(wrapper.text()).toContain('开通会员即可解锁全部会员全局主题、会员局部装扮');
    expect(wrapper.text()).toContain('同乡灯会');
    expect(wrapper.text()).toContain('去参与活动');
    expect(wrapper.text()).toContain('去录乡音');
    expect(wrapper.text()).toContain('方言达人徽章');
    expect(wrapper.text()).toContain('每日录一段乡音可领取少量装扮碎片');
    expect(wrapper.text()).toContain('同乡、同方言圈子用户');
    expect(wrapper.text()).toContain(THEME_ACCESS_FOOTER[0]);
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');

    expect(wrapper.text()).toContain('录音数从贡献履历自动核验');
    expect(wrapper.text()).not.toContain('记录一次录音贡献');
    wrapper.vm.claimDailyShards();
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('keeps the verified contribution snapshot without an authenticated request', async () => {
    setCreatorProgress({ recordings: 4 });
    const wrapper = mount(ThemeAcquirePage, {
      global: { stubs: stubs() },
    });

    await wrapper.vm.syncContributionCount();

    expect(getMyContributionHistory).not.toHaveBeenCalled();
    expect(wrapper.vm.progress.recordings).toBe(4);
  });

  it('refreshes contribution progress for a signed-in user', async () => {
    uni.setStorageSync('token', 'signed-in-token');
    getMyContributionHistory.mockResolvedValue({ summary: { recordings: 12 } });
    const wrapper = mount(ThemeAcquirePage, {
      global: { stubs: stubs() },
    });

    await wrapper.vm.syncContributionCount();

    expect(getMyContributionHistory).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.progress.recordings).toBe(12);
  });

  it('activates membership for both H5 and mini program', () => {
    const wrapper = mount(ThemeMemberPage, {
      global: { stubs: stubs() },
    });
    expect(wrapper.text()).toContain('一处开通，装扮资格跟随账号');
    expect(wrapper.text()).toContain('解锁全部会员全局主题、会员局部装扮');
    expect(getMemberStatus()).toBe(false);
    wrapper.vm.onToggle();
    expect(getMemberStatus()).toBe(true);
    expect(notifySuccess).toHaveBeenCalledWith('会员已开通，装扮权益两端同步');
  });

  it('claims an active event and blocks ended events', async () => {
    const wrapper = mount(ThemeEventPage, {
      global: { stubs: stubs() },
    });
    wrapper.vm.kind = 'theme';
    wrapper.vm.itemId = 'event-lantern';
    wrapper.vm.refresh();
    await wrapper.vm.onClaim();
    expect(isOwned('theme', 'event-lantern')).toBe(true);
    expect(notifySuccess).toHaveBeenCalledWith('恭喜，已获得该装扮，可前往我的装扮使用');

    wrapper.vm.itemId = 'event-spring';
    wrapper.vm.refresh();
    expect(wrapper.vm.eventStatus).toBe('活动已结束');
    expect(wrapper.vm.eventTone).toBe('warning');
    await wrapper.vm.onClaim();
    expect(notify).toHaveBeenCalledWith({ title: '该限定装扮活动已结束，无法获取' });
    expect(isOwned('theme', 'event-spring')).toBe(false);

    wrapper.vm.itemId = 'missing-theme';
    wrapper.vm.refresh();
    expect(wrapper.vm.eventStatus).toBe('活动不可用');
    expect(wrapper.vm.eventIntro).toContain('活动链接可能已失效');
  });
});
