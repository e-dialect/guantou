<template>
  <view
    class="comment-sheet"
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
    >
      <view
        class="comment-sheet__grip"
        @touchstart="onDragStart"
        @touchmove="onDragMove"
        @touchend="onDragEnd"
      />
      <scroll-view
        class="comment-sheet__scroll"
        scroll-y
      >
        <CommentThread
          v-if="targetId"
          :key="`${targetType}-${targetId}`"
          :target-type="targetType"
          :target-id="targetId"
        />
      </scroll-view>
    </view>
  </view>
</template>

<script>
import CommentThread from '@/components/CommentThread.vue';
import {
  registerCommentSheetHost,
  unregisterCommentSheetHost,
} from '@/services/commentSheet';

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
      dragStartY: 0,
      dragDelta: 0,
    };
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
      this.closeTimer = setTimeout(() => {
        this.targetId = null;
        this.targetType = null;
      }, CLOSE_MS);
    },
    onDragStart(event) {
      this.dragStartY = event.touches && event.touches[0]
        ? event.touches[0].clientY
        : 0;
      this.dragDelta = 0;
    },
    onDragMove(event) {
      const y = event.touches && event.touches[0] ? event.touches[0].clientY : 0;
      this.dragDelta = y - this.dragStartY;
    },
    onDragEnd() {
      if (this.dragDelta > DRAG_CLOSE_PX) this.close();
      this.dragDelta = 0;
    },
  },
};
</script>

<style scoped>
.comment-sheet {
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
 */
.comment-sheet--immersive {
  --surface-color: var(--immersive-bg-soft-color);
  --surface-subtle-color: var(--immersive-surface-color);
  --text-color: var(--on-immersive-color);
  --text-secondary-color: var(--on-immersive-muted-color);
  --muted-color: var(--on-immersive-muted-color);
  --border-color: var(--immersive-border-color);
  --accent-color: var(--immersive-accent-color);
}

.comment-sheet__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
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
