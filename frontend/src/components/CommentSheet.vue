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
        :class="{
          'comment-sheet__panel--active': active,
          'comment-sheet__panel--full': mode === 'full',
        }"
        :style="panelStyle"
      >
        <view
          class="comment-sheet__grip"
          @touchstart="onDragStart"
          @touchmove="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="onDragCancel"
        >
          <view class="comment-sheet__grip-bar" />
        </view>
        <!-- key 随目标切换重挂载，归零滚动位置（#257） -->
        <scroll-view
          :key="`${targetType}-${targetId}`"
          class="comment-sheet__scroll"
          scroll-y
        >
          <CommentThread
            ref="thread"
            :target-type="targetType"
            :target-id="targetId"
            @reply="onReply"
          />
        </scroll-view>
        <!-- 发表评论/回复固定在面板底部（半屏/全屏都如此），占位小（问题 2） -->
        <view class="comment-sheet__composer">
          <view
            v-if="replyTarget"
            class="comment-sheet__reply-hint"
          >
            <text class="comment-sheet__reply-hint-text">
              回复 @{{ replyTarget.nickname }}
            </text>
            <text
              class="comment-sheet__reply-cancel"
              @tap="cancelReply"
            >
              取消
            </text>
          </view>
          <view class="comment-sheet__composer-row">
            <BaseField
              v-model="draft"
              name="comment"
              type="textarea"
              :maxlength="500"
              :placeholder="replyTarget ? '回复……' : '说说你的依据、读法或补充……'"
              :autosize="{ minHeight: 36, maxHeight: 160 }"
            />
            <BaseButton
              class="comment-sheet__send"
              text="发送"
              size="small"
              :loading="submitting"
              @click="submit"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import CommentThread from '@/components/CommentThread.vue';
import BaseField from '@/components/BaseField.vue';
import BaseButton from '@/components/BaseButton.vue';
import {
  registerCommentSheetHost,
  unregisterCommentSheetHost,
} from '@/services/commentSheet';

// 与下方 .comment-sheet__mask / __panel 的 transition 时长（0.28s）同步，改动需两边一致（#257）。
const CLOSE_MS = 280;
// 上拉/下拉触发吸附的位移阈值（px）。
const DRAG_SNAP_PX = 60;

export default {
  name: 'CommentSheet',
  components: { CommentThread, BaseField, BaseButton },
  emits: ['active-change'],
  data() {
    return {
      targetType: null,
      targetId: null,
      theme: 'default',
      active: false,
      // half | full：半屏为默认态，上拉进入全屏、下拉退回半屏/退出。
      mode: 'half',
      closeTimer: null,
      dragging: false,
      dragStartY: 0,
      dragDelta: 0,
      draft: '',
      submitting: false,
      replyTarget: null,
      lastSubmitAt: 0,
    };
  },
  computed: {
    /*
     * 拖拽跟手：下拉整体下移、半屏上拉增高，拖拽期间关闭过渡，松手由 CSS 过渡吸附。
     * 全屏态上拉无效果（已到顶），半屏态上拉增高预览「进入全屏」。
     */
    panelStyle() {
      if (!this.dragging) return {};
      if (this.dragDelta > 0) {
        return { transform: `translateY(${this.dragDelta}px)`, transition: 'none' };
      }
      if (this.dragDelta < 0 && this.mode === 'half') {
        return { height: `calc(50vh + ${-this.dragDelta}px)`, transition: 'none' };
      }
      return {};
    },
  },
  watch: {
    active(value) {
      // 面板开合同步给宿主页面，用于锁定底层罐头流的滑动（问题 1）
      this.$emit('active-change', value);
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
      this.mode = 'half';
      this.draft = '';
      this.replyTarget = null;
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
        this.mode = 'half';
      }, CLOSE_MS);
    },
    /* 返回键拦截（#255）：面板激活时由 pages/index.vue 的 onBackPress 调用 */
    isActive() {
      return this.active;
    },
    onReply(payload) {
      // 回复特定评论：切换到底部输入框的「回复 @某人」模式（问题 2）
      this.replyTarget = payload;
      this.draft = '';
    },
    cancelReply() {
      this.replyTarget = null;
      this.draft = '';
    },
    async submit() {
      const now = Date.now();
      // 防连点/双击：`submitting` 只覆盖提交进行中，双击（tap+click）第二次可能落在提交完成后，
      // 用时间窗再拦一道，避免回复/评论被重复发送。
      if (this.submitting || (this.lastSubmitAt && now - this.lastSubmitAt < 500)) return;
      this.lastSubmitAt = now;
      this.submitting = true;
      try {
        if (this.replyTarget) {
          const reply = await this.$refs.thread.submitReply({
            replyToId: this.replyTarget.replyToId,
            parentId: this.replyTarget.parentId,
            content: this.draft,
          });
          if (reply) {
            this.draft = '';
            this.replyTarget = null;
          }
        } else {
          const comment = await this.$refs.thread.submitComment(this.draft);
          if (comment) this.draft = '';
        }
      } finally {
        this.submitting = false;
      }
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
      // 负值=上拉、正值=下拉。
      this.dragDelta = y - this.dragStartY;
    },
    onDragEnd() {
      if (!this.dragging) return;
      const delta = this.dragDelta;
      this.dragDelta = 0;
      this.dragging = false;
      if (delta < -DRAG_SNAP_PX) {
        // 上拉进入全屏评论（问题 1）
        if (this.mode === 'half') this.mode = 'full';
        return;
      }
      if (delta > DRAG_SNAP_PX) {
        // 下拉：全屏退回半屏、半屏直接退出（问题 1）
        if (this.mode === 'full') this.mode = 'half';
        else this.close();
      }
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
  /* 时长须与 JS CLOSE_MS（280ms）同步；height 用于半屏↔全屏吸附 */
  transition: transform 0.28s ease, height 0.28s ease;
  overflow: hidden;
  pointer-events: none;
}

.comment-sheet__panel--active {
  transform: translateY(0);
  pointer-events: auto;
}

.comment-sheet__panel--full {
  height: 100%;
  border-radius: 0;
}

/* 拖拽命中区：一整条扁平长条（比可见小横条大得多），便于一次命中上拉/下拉 */
.comment-sheet__grip {
  flex: 0 0 auto;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comment-sheet__grip-bar {
  width: 96rpx;
  height: 10rpx;
  border-radius: var(--radius-pill);
  background: var(--border-color);
}

.comment-sheet__scroll {
  flex: 1;
  min-height: 0;
  /* 关键：uni-scroll-view 默认 height:100% 会撑满整个面板、挤掉底部输入框并破坏滚动，
   * 这里归零高度交给 flex:1 计算剩余空间；overscroll-behavior 阻断滚动链，避免评论滚到底
   * 又把底层罐头流/页面一起带起来 */
  height: 0;
  padding: 0 24rpx 24rpx;
  box-sizing: border-box;
  overscroll-behavior: contain;
}

/* 底部固定发表评论/回复框：横向输入 + 小发送键，占位小 */
.comment-sheet__composer {
  flex: 0 0 auto;
  padding: 0 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border-color);
  background: var(--surface-color);
}

.comment-sheet__reply-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0 0;
}

.comment-sheet__reply-hint-text {
  color: var(--accent-color);
  font-size: 22rpx;
}

.comment-sheet__reply-cancel {
  color: var(--muted-color);
  font-size: 22rpx;
}

.comment-sheet__composer-row {
  display: flex;
  /* 输入框与发送键上下对齐（问题 1） */
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0 0;
}

.comment-sheet__composer-row .base-field {
  flex: 1;
  min-width: 0;
  /* 去掉表单项上下内边距，让输入框更紧凑、与发送键对齐 */
  --td-form-item-vertical-padding: 0;
}

.comment-sheet__send {
  flex: 0 0 auto;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .comment-sheet__mask,
  .comment-sheet__panel {
    transition: none;
  }
}
</style>
