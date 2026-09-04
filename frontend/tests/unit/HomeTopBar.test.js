import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import HomeTopBar from '@/components/home/HomeTopBar.vue';

vi.mock('@/services/homeFeed', () => ({
  HOME_FEED_TABS: [
    { key: 'today', label: '今日罐' },
    { key: 'dialect', label: '同方言' },
    { key: 'following', label: '关注' },
    { key: 'recommended', label: '推荐' },
  ],
}));

function setupUni() {
  globalThis.uni = {
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
}

function mountTopBar(activeTab = 'recommended') {
  return mount(HomeTopBar, { props: { activeTab } });
}

describe('HomeTopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUni();
  });

  it('navigates to the dialect circles page', async () => {
    const wrapper = mountTopBar();

    await wrapper.find('[aria-label="方言圈"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/circles/index' });
  });

  it('navigates to the discovery page', async () => {
    const wrapper = mountTopBar();

    await wrapper.find('[aria-label="发现"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/discovery/index' });
  });

  it('navigates to the search page', async () => {
    const wrapper = mountTopBar();

    await wrapper.find('[aria-label="查找词条"]').trigger('tap');

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/search' });
  });

  it('emits change when tapping another tab', async () => {
    const wrapper = mountTopBar('recommended');

    await wrapper.find('[role="tab"]:nth-child(1)').trigger('tap');

    expect(wrapper.emitted('change')).toBeTruthy();
    expect(wrapper.emitted('change')[0]).toEqual(['today']);
  });

  it('does not emit change when tapping the already active tab', async () => {
    const wrapper = mountTopBar('recommended');

    await wrapper.find('[role="tab"]:nth-child(4)').trigger('tap');

    expect(wrapper.emitted('change')).toBeFalsy();
  });

  it('marks the active tab with aria-selected', () => {
    const wrapper = mountTopBar('dialect');

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(tabs[0].attributes('aria-selected')).toBe('false');
  });

  it('slides the single indicator to the active tab slot', async () => {
    const wrapper = mountTopBar('today');

    const indicator = wrapper.find('.home-top-bar__indicator');
    expect(indicator.exists()).toBe(true);
    expect(indicator.attributes('style')).toContain('translateX(0%)');

    await wrapper.setProps({ activeTab: 'following' });

    expect(indicator.attributes('style')).toContain('translateX(200%)');
  });

  it('lets the home shell restyle top and bottom chrome with the active accent', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/index.vue'), 'utf8');
    expect(source).toMatch(/accent-\$\{accent\}/);
    expect(source).toContain('paintNativeChrome');
    expect(source).toContain('hydrateOutfitStyle');
    expect(source).toContain('getAppliedOutfitVars');
    expect(source).toContain(':style="outfitVars"');
    expect(source).toContain('immersive: true');
  });
});
