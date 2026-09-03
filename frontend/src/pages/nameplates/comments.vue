<template>
  <PageShell title="铭牌评论">
    <view
      v-if="nameplate"
      class="comment-context"
      @tap="openDetail"
    >
      <view class="comment-context__label">
        正在讨论这张铭牌
      </view>
      <view class="comment-context__writing">
        {{ nameplate.display_text }}
      </view>
      <view class="comment-context__definition">
        {{ nameplate.definition || '暂无释义' }}
      </view>
    </view>
    <CommentThread
      v-if="id"
      target-type="nameplate"
      :target-id="id"
      standalone
    />
  </PageShell>
</template>

<script>
import CommentThread from '@/components/CommentThread.vue';
import PageShell from '@/components/PageShell.vue';
import { getNameplate } from '@/services/guantou';
import { goNameplateDetail } from '@/services/navigation';

export default {
  components: { CommentThread, PageShell },
  data() { return { id: null, nameplate: null }; },
  onLoad(options) {
    this.id = Number(options.id);
    this.load();
  },
  methods: {
    async load() { this.nameplate = await getNameplate(this.id); },
    openDetail() { goNameplateDetail(this.id); },
  },
};
</script>

<style scoped>
.comment-context {
  margin-bottom: 26rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--border-color);
  border-left: 8rpx solid var(--accent-color);
  border-radius: 6rpx;
  background: var(--surface-color);
}
.comment-context__label { color: var(--muted-color); font-size: 20rpx; letter-spacing: 2rpx; }
.comment-context__writing {
  margin-top: 8rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 46rpx;
  font-weight: 900;
}
.comment-context__definition {
  margin-top: 8rpx;
  color: var(--text-secondary-color);
  font-size: 23rpx;
  line-height: 1.5;
}
</style>
