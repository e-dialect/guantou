import { THEME_FAULT_TOAST } from '@/services/themeFault';

export {
  THEME_EMPTY_ACTION_LABELS,
  THEME_EMPTY_SCENE_LABELS,
} from '@/services/themeAnalyticsLabels';

export const THEME_EMPTY_SCENE = {
  catalog: 'catalog',
  filter: 'filter',
  search: 'search',
  favorites: 'favorites',
  recent: 'recent',
  mix: 'mix',
  dressComing: 'dress_coming',
  dressApplied: 'dress_applied',
  catalogFail: 'catalog_fail',
};

export const THEME_EMPTY_COPY = {
  catalog: {
    title: '暂无可用主题，更多方言主题正在制作中',
  },
  filter: {
    title: '当前筛选条件下暂无可用装扮',
    actionText: '重置筛选',
    action: 'reset',
  },
  search: {
    title: '没有找到相关主题或装扮，换个关键词试试',
    actionText: '返回列表',
    action: 'exit',
  },
  favorites: {
    title: '你还没有收藏任何主题装扮，快去挑选喜欢的吧',
    actionText: '去挑选',
    action: 'browse',
  },
  recent: {
    title: '暂无最近使用记录，快去挑选装扮吧',
  },
  mix: {
    title: '还没有保存任何搭配方案，可将当前装扮保存为专属搭配',
    actionText: '保存当前搭配',
    action: 'save',
  },
  dress_coming: {
    title: '该分类装扮素材即将上线，敬请期待',
  },
  dress_applied: {
    title: '暂未设置局部装扮，快去搭配你的专属界面',
    actionText: '去搭配',
    action: 'dress',
  },
  catalog_fail: {
    title: THEME_FAULT_TOAST.catalogFail,
    actionText: '重试',
    action: 'retry',
  },
};

export function themeEmptyCopy(scene) {
  return THEME_EMPTY_COPY[scene] || { title: '' };
}
