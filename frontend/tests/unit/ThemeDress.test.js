import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import confirmDialog from '@/components/ConfirmDialog';
import { notify, notifySuccess } from '@/services/feedback';
import { isWechatMiniProgram } from '@/services/platform';
import {
  getThemeAnalyticsQueue,
  resetThemeAnalyticsQueue,
} from '@/services/themeAnalytics';
import { THEME_OVERLAY_STORAGE_KEY, resetThemeSessionState } from '@/services/themeCenter';
import { resetThemeFaultAdapters } from '@/services/themeFault';
import ThemeDressPage from '@/pages/users/theme-dress.vue';

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/platform', () => ({
  isWechatMiniProgram: vi.fn(() => false),
  default: vi.fn(() => false),
}));

vi.mock('@/components/ConfirmDialog', () => ({
  default: vi.fn(async () => true),
}));

describe('Theme dress page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeAnalyticsQueue();
    resetThemeFaultAdapters();
    resetThemeSessionState();
    const store = {};
    global.getCurrentPages = vi.fn(() => [{ route: 'pages/users/theme-dress' }]);
    global.uni = {
      getStorageSync: vi.fn((key) => store[key] ?? ''),
      setStorageSync: vi.fn((key, value) => {
        store[key] = value;
      }),
      removeStorageSync: vi.fn((key) => {
        delete store[key];
      }),
      getSystemInfoSync: vi.fn(() => ({ SDKVersion: '2.10.0', theme: 'light' })),
      navigateTo: vi.fn(),
      navigateBack: vi.fn(),
      reLaunch: vi.fn(),
      setClipboardData: vi.fn(({ success }) => success && success()),
      saveImageToPhotosAlbum: vi.fn(({ complete }) => complete && complete()),
    };
  });

  function mountPage() {
    return mount(ThemeDressPage, {
      global: {
        stubs: {
          PageShell: {
            name: 'PageShell',
            props: ['title'],
            template: '<main><slot /></main>',
          },
          EmptyState: {
            name: 'EmptyState',
            props: ['title', 'actionText'],
            template: '<div class="empty">{{ title }}</div>',
          },
          'movable-area': { template: '<div class="zoom-area"><slot /></div>' },
          'movable-view': { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('applies one live item without touching other groups', async () => {
    uni.setStorageSync('ui_local_dress', { cards: 'cards-plain' });
    uni.setStorageSync(THEME_OVERLAY_STORAGE_KEY, '0');
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.refresh();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('系统默认顶栏');
    expect(wrapper.text()).toContain('方言符号顶栏');
    expect(wrapper.text()).toContain('免费');
    expect(wrapper.text()).toContain('会员专属');
    const live = wrapper.vm.items.find((item) => item.id === 'navbar-plain');
    const upcoming = wrapper.vm.items.find((item) => !item.available);
    expect(wrapper.vm.applyLabel(live)).toBe('应用');
    expect(wrapper.vm.applyLabel(upcoming)).toBe('敬请期待');
    expect(wrapper.text()).toContain('敬请期待');
    expect(wrapper.text()).toContain('该分类装扮素材即将上线，敬请期待');
    expect(wrapper.text()).toContain('最新上架');

    wrapper.vm.openDetail(live);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('H5网页版：完整生效');
    expect(wrapper.text()).toContain('实时预览');
    expect(wrapper.text()).toContain('预览仅为模拟效果，不会修改你的界面');
    expect(wrapper.text()).toContain('修改顶部导航栏底色和图标颜色');
    expect(wrapper.vm.canLivePreviewItem(live)).toBe(true);
    expect(wrapper.vm.canLivePreviewItem(upcoming)).toBe(false);

    wrapper.vm.openLivePreview(live);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('示例录音占位');
    expect(wrapper.text()).not.toContain('短视频');
    expect(wrapper.text()).not.toContain('作品');
    wrapper.vm.closePreview();

    wrapper.vm.openDetail(live);
    await wrapper.vm.$nextTick();
    wrapper.vm.openZoom();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.zoomOpen).toBe(true);
    expect(wrapper.text()).toContain('双指缩放查看细节，点空白关闭');
    wrapper.vm.closeDetail();
    expect(wrapper.vm.zoomOpen).toBe(false);

    await wrapper.vm.onApply(live);
    expect(notifySuccess).toHaveBeenCalledWith('装扮已生效');
    expect(uni.getStorageSync('ui_local_dress')).toEqual({
      cards: 'cards-plain',
      navbar: 'navbar-plain',
    });
    expect(wrapper.vm.appliedId).toBe('navbar-plain');
    expect(wrapper.vm.applyLabel(live)).toBe('已应用');
  });

  it('clears one applied group so it follows the global theme', async () => {
    uni.setStorageSync(THEME_OVERLAY_STORAGE_KEY, '0');
    const wrapper = mountPage();
    wrapper.vm.groupId = 'cards';
    wrapper.vm.refresh();
    const live = wrapper.vm.items.find((item) => item.id === 'cards-plain');
    await wrapper.vm.onApply(live);
    expect(wrapper.vm.appliedId).toBe('cards-plain');
    wrapper.vm.onClear();
    expect(notifySuccess).toHaveBeenCalledWith('已恢复跟随全局主题');
    expect(wrapper.vm.appliedId).toBe('');
    expect(uni.getStorageSync('ui_local_dress')).toEqual({});
  });

  it('keeps applied dress when overlay suppresses it', async () => {
    uni.setStorageSync(THEME_OVERLAY_STORAGE_KEY, '1');
    const wrapper = mountPage();
    wrapper.vm.groupId = 'actions';
    wrapper.vm.refresh();
    const live = wrapper.vm.items.find((item) => item.id === 'actions-plain');
    await wrapper.vm.onApply(live);
    expect(notifySuccess).toHaveBeenCalledWith('装扮已生效');
    expect(wrapper.text()).toContain('暂时失效');
  });

  it('does not apply upcoming placeholders', async () => {
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.refresh();
    const upcoming = wrapper.vm.items.find((item) => !item.available);
    await wrapper.vm.onApply(upcoming);
    expect(notify).toHaveBeenCalledWith({ title: '装扮素材即将上线' });
    expect(wrapper.vm.appliedId).toBe('');
  });

  it('opens the member gate for member-only dress', async () => {
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.refresh();
    const memberItem = wrapper.vm.items.find((item) => item.id === 'navbar-member');
    await wrapper.vm.onApply(memberItem);
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      confirmText: '开通会员',
    }));
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/users/theme-member',
    });
  });

  it('keeps the access tag and overlays a mini-program limit', async () => {
    isWechatMiniProgram.mockReturnValue(true);
    uni.setStorageSync('ui_theme_member', '1');
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.isMiniProgram = true;
    wrapper.vm.refresh();
    await wrapper.vm.$nextTick();
    const memberItem = wrapper.vm.items.find((item) => item.id === 'navbar-member');
    expect(wrapper.text()).toContain('会员专属');
    expect(wrapper.vm.mpHintFor(memberItem)).toBe('拥有权限，但小程序环境暂不支持该装扮');
    await wrapper.vm.onApply(memberItem);
    expect(notify).toHaveBeenCalledWith({
      title: '拥有权限，但小程序环境暂不支持该装扮',
    });
  });

  it('favorites and shares live dress items', async () => {
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.refresh();
    await wrapper.vm.$nextTick();
    const live = wrapper.vm.items.find((item) => item.id === 'navbar-plain');
    await wrapper.vm.onToggleFavorite(live);
    expect(notifySuccess).toHaveBeenCalledWith('已收藏该装扮');
    await wrapper.vm.onShare(live);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('分享这个装扮');
    const upcoming = wrapper.vm.items.find((item) => !item.available);
    await wrapper.vm.onShare(upcoming);
    expect(notify).toHaveBeenCalledWith({ title: '待上线装扮暂不支持分享' });
  });

  it('records detail browse for upcoming dress and collect events', async () => {
    const wrapper = mountPage();
    wrapper.vm.groupId = 'navbar';
    wrapper.vm.refresh();
    const live = wrapper.vm.items.find((item) => item.id === 'navbar-plain');
    const upcoming = wrapper.vm.items.find((item) => !item.available);
    wrapper.vm.openDetail(upcoming);
    await wrapper.vm.$nextTick();
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_item_enter_detail'
      && row.params.item_id === upcoming.id
      && row.params.catalog_status === 'upcoming'
    ))).toBe(true);
    await wrapper.vm.onToggleFavorite(live);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_collect_click' && row.params.collect_state === '收藏'
    ))).toBe(true);
    await wrapper.vm.onApply(upcoming);
    expect(getThemeAnalyticsQueue().some((row) => (
      row.event === 'theme_apply_invalid_item'
      && row.params.item_status === '已下架'
    ))).toBe(true);
  });
});
