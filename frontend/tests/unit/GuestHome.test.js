import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/homeFeed', () => ({
  resolveDefaultTab: vi.fn(() => 'recommended'),
  getNameplatePreview: vi.fn(),
  getTodayCan: vi.fn(),
  listHomeFeed: vi.fn(),
  HOME_FEED_TABS: [
    { key: 'today', label: '今日罐' },
    { key: 'dialect', label: '同方言' },
    { key: 'following', label: '关注' },
    { key: 'recommended', label: '推荐' },
  ],
}));

vi.mock('@/services/guantou', () => ({
  supportNameplate: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
  preload: vi.fn(),
}));

import HomePage from '@/pages/index.vue';
import CanStageCard from '@/components/home/CanStageCard.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import NameplateVoteRow from '@/components/home/NameplateVoteRow.vue';
import { getNameplatePreview, resolveDefaultTab } from '@/services/homeFeed';
import { supportNameplate } from '@/services/guantou';

function setupUni(token = '') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
  globalThis.getCurrentPages = vi.fn(() => []);
  globalThis.getApp = vi.fn(() => ({ globalData: {} }));
}

function mountHome() {
  return mount(HomePage, {
    global: {
      stubs: {
        HomeFeed: {
          props: ['tab'],
          template: '<div class="home-feed-stub" :data-tab="tab" />',
        },
        HomeTopBar: {
          props: ['activeTab'],
          template: '<div class="home-top-bar-stub" :data-active="activeTab">乡声集盒</div>',
        },
        HomeTabBar: true,
        CommentSheet: true,
      },
    },
  });
}

function triggerShow(wrapper) {
  const hook = wrapper.vm.$options.onShow;
  (Array.isArray(hook) ? hook : [hook]).forEach((fn) => fn.call(wrapper.vm));
}

describe('immersive home (Issue #192)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveDefaultTab.mockReturnValue('recommended');
    getNameplatePreview.mockReturnValue({ previews: [], total: 0 });
  });

  it('guest lands on the recommended feed', () => {
    setupUni();
    resolveDefaultTab.mockReturnValue('recommended');

    const wrapper = mountHome();

    expect(resolveDefaultTab).toHaveBeenCalled();
    expect(wrapper.find('.home-feed-stub').attributes('data-tab')).toBe('recommended');
    expect(wrapper.find('.home-top-bar-stub').attributes('data-active')).toBe('recommended');
  });

  it('user with a primary dialect lands on the dialect feed', () => {
    setupUni('token-value');
    resolveDefaultTab.mockReturnValue('dialect');

    const wrapper = mountHome();

    expect(wrapper.find('.home-feed-stub').attributes('data-tab')).toBe('dialect');
    expect(wrapper.find('.home-top-bar-stub').attributes('data-active')).toBe('dialect');
  });

  it('stage card renders the top nameplate previews', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '巴适', definition: '舒服', support_count: 12, supported_by_current_user: false },
        { id: 2, display_text: '巴适得板', definition: '很舒服', support_count: 8, supported_by_current_user: false },
      ],
      total: 5,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 5,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(getNameplatePreview).toHaveBeenCalledWith(11, expect.any(Object));
    const rows = wrapper.findAllComponents(NameplateVoteRow);
    expect(rows).toHaveLength(2);
    expect(rows.at(0).props('compact')).toBe(false);
    expect(rows.at(1).props('compact')).toBe(true);
    expect(wrapper.text()).toContain('巴适');
    expect(wrapper.text()).toContain('巴适得板');
    expect(wrapper.text()).toContain('+ 3 张铭牌');
  });

  it('stage card caps nameplate previews at one primary plus two secondary', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '巴适', definition: '舒服', support_count: 12, supported_by_current_user: false },
        { id: 2, display_text: '巴适得板', definition: '很舒服', support_count: 8, supported_by_current_user: false },
        { id: 3, display_text: '安逸', definition: '舒适', support_count: 5, supported_by_current_user: false },
        { id: 4, display_text: '要得', definition: '好的', support_count: 2, supported_by_current_user: false },
      ],
      total: 7,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 7,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const rows = wrapper.findAllComponents(NameplateVoteRow);
    expect(rows).toHaveLength(3);
    expect(wrapper.text()).toContain('安逸');
    expect(wrapper.text()).not.toContain('要得');
    expect(wrapper.text()).toContain('+ 4 张铭牌');
  });

  it('secondary nameplates keep the action bar with all three actions in compact form', async () => {
    setupUni();
    getNameplatePreview.mockReturnValue({
      previews: [
        { id: 1, is_primary: true, display_text: '巴适', definition: '舒服', support_count: 12, supported_by_current_user: false },
        { id: 2, display_text: '巴适得板', definition: '很舒服', support_count: 8, supported_by_current_user: false },
        { id: 3, display_text: '安逸', definition: '舒适', support_count: 5, supported_by_current_user: false },
      ],
      total: 3,
    });

    const wrapper = mount(CanStageCard, {
      props: {
        can: {
          id: 11,
          concept_text: '舒服',
          audio_url: 'https://example.com/a.mp3',
          nameplate_previews: [],
          nameplate_total: 3,
          recorder: { id: 3, nickname: '老乡', avatar: '' },
          submitted_dialect: { qualified_code: '西南官话.四川' },
          status: 'verified',
        },
        active: true,
      },
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const compactRow = wrapper.findAllComponents(NameplateVoteRow).at(1);
    expect(compactRow.props('compact')).toBe(true);
    /* Issue #218：副铭牌紧凑形态保留操作条，与主铭牌同构（支持/评论/立论） */
    const actions = compactRow.find('.plate-card__actions');
    expect(actions.exists()).toBe(true);
    expect(compactRow.find('.vote-row__support').text()).toContain('支持 8');
    expect(compactRow.find('.plate-card__comment').text()).toContain('评论 0');
    expect(compactRow.find('.plate-card__action--debate').text()).toBe('立论');
  });

  it('guest voting asks for login instead of calling the API', async () => {
    setupUni();

    const wrapper = mount(NameplateVoteRow, {
      props: {
        nameplate: { id: 7, display_text: '巴适', support_count: 3, supported_by_current_user: false },
      },
    });
    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(supportNameplate).not.toHaveBeenCalled();
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(wrapper.vm.supportCount).toBe(3);
  });

  it('tab bar shows the raised 装罐 key and reaches the create page', async () => {
    setupUni('token-value');

    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });

    expect(wrapper.text()).toContain('装罐');
    await wrapper.find('[aria-label="装罐"]').trigger('tap');
    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/create',
    }));
  });

  it('tab bar 装罐 key asks guests to login first', async () => {
    setupUni();

    const wrapper = mount(HomeTabBar, { props: { active: 'home' } });
    await wrapper.find('[aria-label="装罐"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/login',
    }));
    expect(uni.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/cans/create',
    }));
  });

  it('keeps the feed state when returning without an auth change', () => {
    setupUni('token-value');
    const wrapper = mountHome();

    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(0);
  });

  it('rebuilds the feed when the login state changes while away', () => {
    setupUni('');
    const wrapper = mountHome();

    // 模拟登录后返回首页：token 从无到有
    setupUni('token-value');
    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(1);

    // 登录态稳定后的再次返回不再重建
    triggerShow(wrapper);
    expect(wrapper.vm.feedRevision).toBe(1);
  });

  it('rebuilds the feed when the primary dialect changes while away', () => {
    setupUni('token-value');
    const wrapper = mountHome();

    // 模拟 onboarding 换主方言后返回：globalData.userInfo.primary_dialect 从无到有
    globalThis.getApp = vi.fn(() => ({
      globalData: { userInfo: { primary_dialect: { id: 5 } } },
    }));
    triggerShow(wrapper);

    expect(wrapper.vm.feedRevision).toBe(1);
  });
});
