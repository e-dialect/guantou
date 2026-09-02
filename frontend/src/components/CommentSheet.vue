<template>
  <view class="comment-sheet">
    <!-- 空闲时（targetId 为空）不渲染任何全屏层，避免常驻透明浮层在小程序端拦截首页手势（#256） -->
    <view
      v-if="targetId"
      class="comment-sheet__layer"
      :class="`comment-sheet--${theme}`"
      :aria-hidden="active ? null : 'true'"
    >
      <view
        class="comment-sheet__mask"
        :class="{ 'comment-sheet__mask--active': active }"
        @tap="close"
      />
      <view
        class="comment-sheet__panel"
        :class="{ 'comment-sheet__panel--active': active }"
        :style="panelStyle"
      >
        <view
          class="comment-sheet__grip"
          @touchstart="onDragStart"
          @touchmove="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="onDragCancel"
        />
        <!-- key 随目标切换重挂载，归零滚动位置（#257） -->
        <scroll-view
          :key="`${targetType}-${targetId}`"
          class="comment-sheet__scroll"
          scroll-y
        >
          <CommentThread
            :target-type="targetType"
            :target-id="targetId"
          />
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
import CommentThread from '@/components/CommentThread.vue';
import {
  registerCommentSheetHost,
  unregisterCommentSheetHost,
} from '@/services/commentSheet';

// 与下方 .comment-sheet__mask / __panel 的 transition 时长（0.28s）同步，改动需两边一致（#257）。
const CLOSE_MS = 280;
const DRAG_CLOSE_PX = 80;

export default {
  name: 'CommentSheet',
  components: { CommentThread },
  data() {
    return {
      targetType: null,
      targetId: null,
      theme: 'default',
      active: false,
      closeTimer: null,
      dragging: false,
      dragStartY: 0,
      dragDelta: 0,
    };
  },
  computed: {
    /* 拖拽跟手：仅消费向下位移（下拉关闭方向），拖拽期间关闭过渡，松手由 CSS 过渡回弹（#257）。 */
    panelStyle() {
      if (!this.dragging || this.dragDelta <= 0) return {};
      return {
        transform: `translateY(${this.dragDelta}px)`,
        transition: 'none',
      };
    },
  },
  mounted() {
    registerCommentSheetHost(this);
  },
  beforeUnmount() {
    unregisterCommentSheetHost(this);
    if (this.closeTimer) clearTimeout(this.closeTimer);
  },
  methods: {
    open({ targetType, targetId, theme = 'default' }) {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
      this.targetType = targetType;
      this.targetId = targetId;
      this.theme = theme;
      // 先挂载内容，再触发滑入过渡，保证内容在面板出现前已就绪。
      this.$nextTick(() => {
        this.active = true;
      });
    },
    close() {
      if (!this.active) return;
      this.active = false;
      this.dragDelta = 0;
      this.dragging = false;
      this.closeTimer = setTimeout(() => {
        this.targetId = null;
        this.targetType = null;
      }, CLOSE_MS);
    },
    /* 返回键拦截（#255）：面板激活时由 pages/index.vue 的 onBackPress 调用 */
    isActive() {
      return this.active;
    },
    onDragStart(event) {
      this.dragStartY = event.touches && event.touches[0]
        ? event.touches[0].clientY
        : 0;
      this.dragDelta = 0;
      this.dragging = true;
    },
    onDragMove(event) {
      if (!this.dragging) return;
      const y = event.touches && event.touches[0] ? event.touches[0].clientY : 0;
      // 只跟随向下位移；向上位移交给 scroll-view 滚动，不动面板。
      this.dragDelta = Math.max(0, y - this.dragStartY);
    },
    onDragEnd() {
      if (!this.dragging) return;
      if (this.dragDelta > DRAG_CLOSE_PX) {
        this.close();
        return;
      }
      this.dragDelta = 0;
      this.dragging = false;
    },
    onDragCancel() {
      // 手势被系统打断（来电/通知栏等）：复位状态，不关闭面板（#257）。
      this.dragDelta = 0;
      this.dragging = false;
    },
  },
};
</script>

<style scoped>
/* 宿主包裹层：空闲时零占位（无 fixed/尺寸），仅承载 host 注册与 open/close 契约 */
.comment-sheet {
  /* 全屏浮层由 .comment-sheet__layer 在目标就绪后渲染，此处不需要样式 */
}

.comment-sheet__layer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  pointer-events: none;
}

/*
 * 沉浸式深色主题：首页沉浸流内嵌面板把 CommentThread 消费的常规 Token
 * 重映射到 --immersive-* 深色 Token（这些变量由 .immersive-shell 提供）。
 * danger 让「回复加载失败」等错误文案在深底上保持可读（#257）。
 */
.comment-sheet--immersive {
  --surface-color: var(--immersive-bg-soft-color);
  --surface-subtle-color: var(--immersive-surface-color);
  --text-color: var(--on-immersive-color);
  --text-secondary-color: var(--on-immersive-muted-color);
  --muted-color: var(--on-immersive-muted-color);
  --border-color: var(--immersive-border-color);
  --accent-color: var(--immersive-accent-color);
  --danger-color: var(--immersive-danger-color);
  --veil-color: var(--immersive-veil-color);
}

.comment-sheet__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--veil-color);
  opacity: 0;
  pointer-events: none;
  /* 时长须与 JS CLOSE_MS（280ms）同步 */
  transition: opacity 0.28s ease;
}

.comment-sheet__mask--active {
  opacity: 1;
  pointer-events: auto;
}

.comment-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 50vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-color);
  border-radius: 24rpx 24rpx 0 0;
  transform: translateY(100%);
  /* 时长须与 JS CLOSE_MS（280ms）同步 */
  transition: transform 0.28s ease;
  overflow: hidden;
  pointer-events: none;
}

.comment-sheet__panel--active {
  transform: translateY(0);
  pointer-events: auto;
}

.comment-sheet__grip {
  flex: 0 0 auto;
  width: 72rpx;
  height: 8rpx;
  margin: 16rpx auto 8rpx;
  border-radius: var(--radius-pill);
  background: var(--border-color);
}

.comment-sheet__scroll {
  flex: 1;
  min-height: 0;
  padding: 0 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

@media (prefers-reduced-motion: reduce) {
  .comment-sheet__mask,
  .comment-sheet__panel {
    transition: none;
  }
}
</style>
