import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import ThemeCenterDiscoveryView from '@/components/theme-center/ThemeCenterDiscoveryView.vue';
import ThemeCenterFavoritesView from '@/components/theme-center/ThemeCenterFavoritesView.vue';
import ThemeCenterFilterSheet from '@/components/theme-center/ThemeCenterFilterSheet.vue';
import ThemeCenterGlobalView from '@/components/theme-center/ThemeCenterGlobalView.vue';
import ThemeCenterLocalView from '@/components/theme-center/ThemeCenterLocalView.vue';
import ThemeCenterMergeSheet from '@/components/theme-center/ThemeCenterMergeSheet.vue';
import ThemeCenterMineView from '@/components/theme-center/ThemeCenterMineView.vue';
import ThemeCenterOutfitSheet from '@/components/theme-center/ThemeCenterOutfitSheet.vue';
import ThemeCenterRecentView from '@/components/theme-center/ThemeCenterRecentView.vue';
import ThemeCenterThemeDetail from '@/components/theme-center/ThemeCenterThemeDetail.vue';

const BaseButton = {
  props: ['disabled', 'variant'],
  emits: ['click'],
  template: '<button class="base-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};
const BaseField = {
  props: ['modelValue'],
  emits: ['confirm', 'update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'confirm\')">',
};
const BaseForm = { template: '<form><slot /></form>' };
const BaseLoading = {
  props: ['text'],
  template: '<div class="base-loading">{{ text }}</div>',
};
const ThemeStatusPane = {
  props: ['scene'],
  emits: ['action'],
  template: '<button class="status-pane" :data-scene="scene" @click="$emit(\'action\')">{{ scene }}</button>',
};
const TSwitch = {
  props: ['value'],
  emits: ['change'],
  template: '<button class="theme-switch" @click="$emit(\'change\', !value)">{{ value }}</button>',
};

function mountView(component, props = {}) {
  return mount(component, {
    props: { ...viewDefaults.get(component), ...props },
    global: {
      stubs: {
        BaseButton,
        BaseField,
        BaseForm,
        BaseLoading,
        ThemeStatusPane,
        TSwitch,
        'scroll-view': { template: '<div class="scroll-view"><slot /></div>' },
        'movable-area': { template: '<div><slot /></div>' },
        'movable-view': { template: '<div><slot /></div>' },
      },
    },
  });
}

const theme = {
  id: 'paper',
  name: '纸页主题',
  description: '温润纸张',
  blurb: '保留乡音的温度',
  preview: 'paper',
  available: true,
};

const noop = () => false;
const emptyText = () => '';
const emptyList = () => [];
const emptyObject = () => ({});
const primary = () => 'primary';
const enable = () => '启用';
const viewDefaults = new Map([
  [ThemeCenterDiscoveryView, {
    catalogFail: false,
    catalogLoading: false,
    catalogStale: false,
    filterSummary: '',
    hotKeywords: [],
    isGreyEntry: noop,
    memberSyncing: false,
    resultTab: 'all',
    searchActionDisabled: noop,
    searchActionLabel: enable,
    searchActionVariant: primary,
    searchForm: { keyword: '' },
    searching: false,
    searchRows: [],
    searchTabs: [],
    showFilterBar: false,
    tab: 'global',
    tagClass: emptyText,
    themePreviewVars: emptyObject,
  }],
  [ThemeCenterRecentView, {
    recentTagClass: emptyText,
    rows: [],
    themeCoverSrc: emptyText,
    themePreviewVars: emptyObject,
    visible: false,
  }],
  [ThemeCenterGlobalView, {
    activeTheme: theme,
    appearance: 'system',
    appearanceOptions: [],
    catalogBadge: emptyText,
    categories: [],
    category: 'all',
    dialectRegions: [],
    emptyScene: 'catalog',
    footerLines: [],
    isGreyTheme: noop,
    isItemFav: noop,
    isRegionChipOn: noop,
    sortOptions: [],
    statsOf: () => ({ likes: 0 }),
    themeActionDisabled: noop,
    themeActionLabel: enable,
    themeActionVariant: primary,
    themeCoverSrc: emptyText,
    themePreviewVars: emptyObject,
    themeSort: 'newest',
    themeTags: emptyList,
    themes: [],
    visible: false,
  }],
  [ThemeCenterLocalView, {
    dressCategories: [],
    dressCategory: 'all',
    dressItems: [],
    groups: [],
    isGreyEntry: noop,
    searchActionDisabled: noop,
    searchActionLabel: enable,
    searchActionVariant: primary,
    showDressItems: false,
    tagClass: emptyText,
    visible: false,
  }],
  [ThemeCenterFavoritesView, {
    actionDisabled: noop,
    actionLabel: enable,
    actionVariant: primary,
    entries: [],
    filter: 'all',
    filters: [],
    statsOf: () => ({ favorites: 0, likes: 0 }),
    tagClass: emptyText,
    visible: false,
  }],
  [ThemeCenterMineView, {
    accountSyncNote: '',
    acquireOffers: { themes: [], dresses: [] },
    activeTheme: theme,
    appliedDress: [],
    dressActionDisabled: noop,
    dressActionVariant: primary,
    dressStatus: emptyText,
    dressTags: emptyList,
    hasAppliedDress: false,
    outfitPreviewVars: emptyObject,
    outfitSummary: emptyText,
    outfitThemePreview: () => 'paper',
    overlay: false,
    ownedUnused: { themes: [], dresses: [] },
    previewShotClass: [],
    savedOutfits: [],
    tagClass: emptyText,
    themeActionDisabled: noop,
    themeActionVariant: primary,
    themePreviewVars: emptyObject,
    themeTags: emptyList,
    visible: false,
  }],
  [ThemeCenterThemeDetail, {
    canLivePreviewItem: noop,
    catalogBadge: emptyText,
    isItemFav: noop,
    isMiniProgram: false,
    statsOf: () => ({ favorites: 0, liked: false, likes: 0 }),
    theme: null,
    themeAccess: emptyObject,
    themeActionDisabled: noop,
    themeActionLabel: enable,
    themeActionVariant: primary,
    themeDetailSrc: emptyText,
    themeFeatures: [],
    themePreviewVars: emptyObject,
    themeTags: emptyList,
    zoomHint: '',
    zoomOpen: false,
  }],
  [ThemeCenterFilterSheet, {
    accessFilters: [],
    categories: [],
    dialectRegions: [],
    draft: {
      access: 'all', category: 'all', dressCategory: 'all', regions: [], status: 'all', sort: 'newest',
    },
    dressCategories: [],
    isDraftRegionOn: noop,
    open: false,
    sortOptions: [],
    statusFilters: [],
  }],
  [ThemeCenterOutfitSheet, {
    error: '',
    form: { name: '' },
    mode: 'save',
    open: false,
    rules: {},
  }],
  [ThemeCenterMergeSheet, { open: false }],
]);

beforeEach(() => {
  global.uni = {
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  };
});

describe('theme center independent views', () => {
  it('renders discovery loading, error, search-empty, and normal states', async () => {
    const wrapper = mountView(ThemeCenterDiscoveryView, {
      searchForm: { keyword: '' },
      catalogFail: true,
    });
    expect(wrapper.find('[data-scene="catalog_fail"]').exists()).toBe(true);

    await wrapper.setProps({ catalogFail: false, catalogLoading: true });
    expect(wrapper.find('.base-loading').text()).toContain('装扮目录加载中');

    await wrapper.setProps({ catalogLoading: false, searching: true, searchRows: [] });
    expect(wrapper.find('[data-scene="search"]').exists()).toBe(true);

    await wrapper.setProps({ searching: false, hotKeywords: ['家乡'], tab: 'global' });
    expect(wrapper.text()).toContain('家乡');
    await wrapper.find('input').setValue('纸页');
    expect(wrapper.emitted('update-keyword')?.[0]).toEqual(['纸页']);
  });

  it('keeps recent empty and disabled rows independently testable', async () => {
    const wrapper = mountView(ThemeCenterRecentView, { visible: true, rows: [] });
    expect(wrapper.find('[data-scene="recent"]').exists()).toBe(true);

    await wrapper.setProps({
      rows: [{
        id: 'retired',
        kind: 'theme',
        item: theme,
        name: '已下架主题',
        label: '已下架',
        preview: 'paper',
        disabled: true,
      }],
    });
    expect(wrapper.find('.recent-card').classes()).toContain('disabled');
    expect(wrapper.find('.base-button').attributes('disabled')).toBeDefined();
    await wrapper.find('.recent-card').trigger('tap');
    expect(wrapper.emitted('open')?.[0][0].id).toBe('retired');
  });

  it('renders global catalog empty and normal states without the page controller', async () => {
    const wrapper = mountView(ThemeCenterGlobalView, {
      visible: true,
      activeTheme: theme,
      themes: [],
      emptyScene: 'filter',
    });
    expect(wrapper.find('[data-scene="filter"]').exists()).toBe(true);

    await wrapper.setProps({ themes: [theme], footerLines: ['说明边界'] });
    expect(wrapper.text()).toContain('纸页主题');
    expect(wrapper.text()).toContain('说明边界');
    await wrapper.find('.theme-card').trigger('tap');
    expect(wrapper.emitted('open-detail')?.[0]).toEqual([theme]);
  });

  it('renders local catalog empty, filtered, and available group states', async () => {
    const wrapper = mountView(ThemeCenterLocalView, {
      visible: true,
      groups: [],
    });
    expect(wrapper.find('[data-scene="dress_coming"]').exists()).toBe(true);

    await wrapper.setProps({ showDressItems: true, dressItems: [] });
    expect(wrapper.find('[data-scene="filter"]').exists()).toBe(true);

    const group = {
      id: 'cards', name: '录音卡片', hint: '替换卡片外观', preview: 'paper', hasLive: true,
    };
    await wrapper.setProps({ groups: [group] });
    expect(wrapper.text()).toContain('录音卡片');
    await wrapper.findAll('.dress-card').at(-1).trigger('tap');
    expect(wrapper.emitted('open-dress')?.[0]).toEqual([group]);
  });

  it('renders favorites empty and normal states with filter events', async () => {
    const wrapper = mountView(ThemeCenterFavoritesView, {
      visible: true,
      filters: [{ value: 'all', label: '全部' }, { value: 'theme', label: '主题' }],
      entries: [],
    });
    expect(wrapper.find('[data-scene="favorites"]').exists()).toBe(true);

    await wrapper.findAll('.chip').at(1).trigger('tap');
    expect(wrapper.emitted('update-filter')?.[0]).toEqual(['theme']);
    await wrapper.setProps({ entries: [{ kind: 'theme', item: theme }] });
    expect(wrapper.text()).toContain('纸页主题');
  });

  it('renders mine empty and populated outfit states with explicit commands', async () => {
    const wrapper = mountView(ThemeCenterMineView, {
      visible: true,
      activeTheme: theme,
      ownedUnused: { themes: [], dresses: [] },
      acquireOffers: { themes: [], dresses: [] },
    });
    expect(wrapper.find('[data-scene="dress_applied"]').exists()).toBe(true);
    expect(wrapper.find('[data-scene="mix"]').exists()).toBe(true);

    await wrapper.setProps({
      hasAppliedDress: true,
      appliedDress: [{
        group: { id: 'cards', name: '录音卡片' },
        item: { id: 'paper-card', name: '纸页卡片', preview: 'paper' },
        effective: true,
      }],
      savedOutfits: [{ id: 'mix-1', name: '家乡搭配' }],
    });
    expect(wrapper.text()).toContain('纸页卡片');
    expect(wrapper.text()).toContain('家乡搭配');
    await wrapper.find('.theme-switch').trigger('click');
    expect(wrapper.emitted('overlay-change')?.[0]).toEqual([true]);
  });

  it('keeps detail and zoom lifecycle independent from the catalog list', async () => {
    const wrapper = mountView(ThemeCenterThemeDetail, {
      theme,
      themeFeatures: ['导航栏'],
      themeActionLabel: () => '立即启用',
      canLivePreviewItem: () => true,
      statsOf: () => ({ likes: 3, favorites: 2, liked: false }),
    });
    expect(wrapper.text()).toContain('保留乡音的温度');
    expect(wrapper.text()).toContain('导航栏');
    await wrapper.find('.shot-lg').trigger('tap');
    expect(wrapper.emitted('open-zoom')).toHaveLength(1);

    await wrapper.setProps({ zoomOpen: true });
    expect(wrapper.find('.zoom-mask').exists()).toBe(true);
    await wrapper.find('.preview-close').trigger('tap');
    expect(wrapper.emitted('close-zoom')).toHaveLength(1);
  });

  it('exposes filter, outfit, and login-merge sheet decisions as events', async () => {
    const filter = mountView(ThemeCenterFilterSheet, {
      open: true,
      draft: {
        access: 'all', category: 'all', dressCategory: 'all', regions: [], status: 'all', sort: 'newest',
      },
      accessFilters: [{ value: 'owned', label: '已拥有' }],
      isDraftRegionOn: () => false,
    });
    await filter.find('.chip').trigger('tap');
    expect(filter.emitted('update-draft')?.[0]).toEqual([{ field: 'access', value: 'owned' }]);

    const outfit = mountView(ThemeCenterOutfitSheet, {
      open: true,
      form: { name: '' },
    });
    await outfit.find('input').setValue('乡音搭配');
    expect(outfit.emitted('update-name')?.[0]).toEqual(['乡音搭配']);

    const merge = mountView(ThemeCenterMergeSheet, { open: true });
    await merge.findAll('.base-button').at(2).trigger('click');
    expect(merge.emitted('choose')?.[0]).toEqual(['merge']);
  });
});
