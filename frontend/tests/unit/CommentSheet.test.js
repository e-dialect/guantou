import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', () => ({
  goCanComments: vi.fn(),
  goNameplateComments: vi.fn(),
}));

import CommentSheet from '@/components/CommentSheet.vue';
import { openCommentSheet } from '@/services/commentSheet';
import { goCanComments, goNameplateComments } from '@/services/navigation';

function mountSheet() {
  return mount(CommentSheet, {
    global: {
      stubs: {
        CommentThread: {
          props: ['targetType', 'targetId'],
          template: '<div class="thread-stub" :data-type="targetType" :data-id="targetId" />',
        },
        // uni-app 原生滚动容器在 jsdom 中不可解析，静默其解析告警；透传默认插槽以保留 CommentThread
        'scroll-view': {
          template: '<div class="scroll-view-stub"><slot /></div>',
        },
      },
    },
  });
}

describe('CommentSheet (Issue #219)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {};
  });

  describe('service fallback（未挂载 CommentSheet 时）', () => {
    it('整页跳转罐头评论', () => {
      openCommentSheet({ targetType: 'can', targetId: 12, theme: 'immersive' });

      expect(goCanComments).toHaveBeenCalledWith(12);
      expect(goNameplateComments).not.toHaveBeenCalled();
    });

    it('整页跳转铭牌评论', () => {
      openCommentSheet({ targetType: 'nameplate', targetId: 7, theme: 'immersive' });

      expect(goNameplateComments).toHaveBeenCalledWith(7);
      expect(goCanComments).not.toHaveBeenCalled();
    });
  });

  describe('hosted sheet（CommentSheet 挂载后）', () => {
    it('通过注册的 host 打开，并装载目标评论线程', async () => {
      const wrapper = mountSheet();

      openCommentSheet({ targetType: 'can', targetId: 12, theme: 'immersive' });
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.targetType).toBe('can');
      expect(wrapper.vm.targetId).toBe(12);
      expect(wrapper.vm.theme).toBe('immersive');
      expect(wrapper.vm.active).toBe(true);
      expect(wrapper.find('.thread-stub').attributes('data-id')).toBe('12');
      expect(goCanComments).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it('目标未就绪前不渲染评论线程', () => {
      const wrapper = mountSheet();

      expect(wrapper.find('.thread-stub').exists()).toBe(false);

      wrapper.unmount();
    });

    it('点击遮罩关闭，并在过渡结束后清空目标', async () => {
      vi.useFakeTimers();
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.active).toBe(true);

      await wrapper.find('.comment-sheet__mask').trigger('tap');
      expect(wrapper.vm.active).toBe(false);

      vi.advanceTimersByTime(300);
      expect(wrapper.vm.targetId).toBeNull();
      expect(wrapper.vm.targetType).toBeNull();

      wrapper.unmount();
      vi.useRealTimers();
    });
  });
});
