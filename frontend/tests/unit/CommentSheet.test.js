import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', () => ({
  goCanComments: vi.fn(),
  goNameplateComments: vi.fn(),
  goNotFound: vi.fn(),
}));

import CommentSheet from '@/components/CommentSheet.vue';
import {
  isCommentSheetActive,
  openCommentSheet,
} from '@/services/commentSheet';
import { goCanComments, goNameplateComments, goNotFound } from '@/services/navigation';

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

describe('CommentSheet (Issue #219 后续)', () => {
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

    it('未知目标类型不跳转（#257）', () => {
      openCommentSheet({ targetType: 'bogus', targetId: 1 });

      expect(goNotFound).toHaveBeenCalled();
      expect(goCanComments).not.toHaveBeenCalled();
      expect(goNameplateComments).not.toHaveBeenCalled();
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

    it('空闲时全屏浮层不渲染，打开后才出现（#256）', async () => {
      const wrapper = mountSheet();
      expect(wrapper.find('.comment-sheet__layer').exists()).toBe(false);
      expect(wrapper.find('.comment-sheet__mask').exists()).toBe(false);
      expect(wrapper.find('.comment-sheet__panel').exists()).toBe(false);

      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.comment-sheet__layer').exists()).toBe(true);
      expect(wrapper.find('.comment-sheet__mask').exists()).toBe(true);
      expect(wrapper.find('.comment-sheet__panel').exists()).toBe(true);

      wrapper.unmount();
    });

    it('isCommentSheetActive 反映面板激活态（#255）', async () => {
      const wrapper = mountSheet();
      expect(isCommentSheetActive()).toBe(false);

      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();
      expect(isCommentSheetActive()).toBe(true);

      wrapper.vm.close();
      expect(isCommentSheetActive()).toBe(false);

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

    it('拖拽超过阈值关闭面板，未达阈值回弹（#257）', async () => {
      vi.useFakeTimers();
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      const grip = wrapper.find('.comment-sheet__grip');
      await grip.trigger('touchstart', { touches: [{ clientY: 100 }] });
      // 向上位移不跟随（交给 scroll-view 滚动）
      await grip.trigger('touchmove', { touches: [{ clientY: 40 }] });
      expect(wrapper.vm.dragDelta).toBe(0);
      // 向下位移跟手
      await grip.trigger('touchmove', { touches: [{ clientY: 300 }] });
      expect(wrapper.vm.dragDelta).toBe(200);
      await grip.trigger('touchend');
      expect(wrapper.vm.active).toBe(false);

      vi.advanceTimersByTime(300);
      expect(wrapper.vm.targetId).toBeNull();

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('手势取消时复位状态且不关闭（#257）', async () => {
      const wrapper = mountSheet();
      openCommentSheet({ targetType: 'can', targetId: 12 });
      await wrapper.vm.$nextTick();

      const grip = wrapper.find('.comment-sheet__grip');
      await grip.trigger('touchstart', { touches: [{ clientY: 100 }] });
      await grip.trigger('touchmove', { touches: [{ clientY: 300 }] });
      expect(wrapper.vm.dragDelta).toBe(200);

      await grip.trigger('touchcancel');
      expect(wrapper.vm.dragging).toBe(false);
      expect(wrapper.vm.dragDelta).toBe(0);
      expect(wrapper.vm.active).toBe(true);

      wrapper.unmount();
    });
  });
});
