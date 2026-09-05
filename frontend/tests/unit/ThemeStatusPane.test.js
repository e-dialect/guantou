import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';
import { trackThemeEmptyClick, trackThemeEmptyShow } from '@/services/themeAnalytics';

vi.mock('@/services/themeAnalytics', () => ({
  trackThemeEmptyClick: vi.fn(),
  trackThemeEmptyShow: vi.fn(),
}));

const BaseButton = {
  props: ['text'],
  emits: ['click'],
  template: '<button class="base-button" @click="$emit(\'click\')">{{ text }}</button>',
};
const EmptyState = {
  props: ['actionText', 'description', 'title'],
  emits: ['action'],
  template: '<button class="empty-state" @click="$emit(\'action\')">{{ title }} {{ description }} {{ actionText }}</button>',
};

function mountPane(props) {
  return mount(ThemeStatusPane, {
    props,
    global: { stubs: { BaseButton, EmptyState } },
  });
}

describe('ThemeStatusPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the complete EmptyState presentation by default', () => {
    const wrapper = mountPane({ scene: 'favorites' });

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.find('.theme-status-pane--compact').exists()).toBe(false);
    expect(wrapper.text()).toContain('你还没有收藏任何主题装扮');
    expect(trackThemeEmptyShow).toHaveBeenCalledWith('favorites');
  });

  it('renders recent history as a compact secondary status without changing its copy', () => {
    const wrapper = mountPane({ compact: true, scene: 'recent' });

    expect(wrapper.find('.empty-state').exists()).toBe(false);
    expect(wrapper.find('.theme-status-pane--compact').exists()).toBe(true);
    expect(wrapper.text()).toBe('暂无最近使用记录，快去挑选装扮吧');
    expect(trackThemeEmptyShow).toHaveBeenCalledWith('recent');
  });

  it('preserves action analytics and events when compact copy has an action', async () => {
    const wrapper = mountPane({ compact: true, scene: 'favorites' });

    await wrapper.find('.base-button').trigger('click');

    expect(trackThemeEmptyClick).toHaveBeenCalledWith('favorites', 'browse');
    expect(wrapper.emitted('action')).toHaveLength(1);
  });
});
