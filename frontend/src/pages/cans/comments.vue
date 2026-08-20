<template>
  <PageShell title="罐头评论">
    <view class="can-comment-note">
      这里讨论录音、录制现场和说话人信息；针对具体写法或读音的讨论，请进入对应铭牌。
    </view>
    <CommentThread
      v-if="canId"
      target-type="can"
      :target-id="canId"
    />
  </PageShell>
</template>

<script>
import CommentThread from '@/components/CommentThread.vue';
import PageShell from '@/components/PageShell.vue';

export default {
  components: { CommentThread, PageShell },
  data() { return { canId: null }; },
  onLoad(options) { this.canId = Number(options.id); },
};
</script>

<style scoped>
.can-comment-note {
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  border-left: 7rpx solid var(--accent-color);
  background: var(--surface-color);
  color: var(--muted-color);
  font-size: 22rpx;
  line-height: 1.6;
}
</style>
