<template>
  <view
    class="plate"
    :class="{ 'plate--primary': plate.is_primary }"
  >
    <view
      class="plate__body"
      @tap="$emit('open', plate.id)"
    >
      <view class="plate__kicker">
        {{ plate.is_primary ? '主铭牌' : '并列铭牌' }} · {{ plate.dialect?.name || '方言点待补' }}
      </view>
      <view class="plate__title">
        {{ plate.display_text || plate.text_content || '未命名铭牌' }}
      </view>
      <view
        v-if="readingText"
        class="plate__reading"
      >
        {{ readingText }}
      </view>
      <view class="plate__definition">
        {{ plate.definition || '暂无释义' }}
      </view>
      <view class="plate__source">
        {{ sourceText }} · 查看完整依据 ›
      </view>
    </view>
    <view class="plate__actions">
      <view @tap.stop="$emit(plate.supported_by_current_user ? 'unsupport' : 'support', plate.id)">
        {{ plate.supported_by_current_user ? '已支持' : '支持' }} {{ plate.support_count || 0 }}
      </view>
      <view @tap.stop="$emit('comments', plate.id)">
        评论 {{ plate.comment_count || 0 }}
      </view>
      <view
        class="plate__debate"
        @tap.stop="$emit('debate', plate)"
      >
        立论
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'NameplateCard',
  props: { plate: { type: Object, required: true } },
  emits: ['comments', 'debate', 'open', 'support', 'unsupport'],
  computed: {
    readingText() {
      const pronunciation = this.plate.pronunciation || {};
      const base = pronunciation.base_romanization || '';
      const surface = pronunciation.surface_romanization
        || this.plate.pronunciation_text || pronunciation.ipa || '';
      if (base && surface && base !== surface) return `${base} → ${surface}`;
      return surface || base;
    },
    sourceText() {
      const source = this.plate.source || {};
      return source.title
        || source.attributed_to
        || source.note
        || this.plate.source_type
        || '来源未注明';
    },
  },
};
</script>

<style scoped>
.plate {
  margin-bottom: 20rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}
.plate--primary {
  border-left: 8rpx solid var(--accent-color);
  background: var(--accent-subtle-color);
}
.plate__body { padding: 24rpx 26rpx 20rpx; }
.plate__kicker {
  color: var(--accent-color);
  font-size: 19rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
.plate__title {
  margin-top: 8rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 46rpx;
  font-weight: 900;
}
.plate__reading {
  margin-top: 7rpx;
  color: var(--text-color);
  font-size: 25rpx;
  letter-spacing: 2rpx;
}
.plate__definition {
  margin-top: 10rpx;
  color: var(--text-secondary-color);
  font-size: 25rpx;
  line-height: 1.55;
}
.plate__source { margin-top: 12rpx; color: var(--muted-color); font-size: 20rpx; }
.plate__actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-top: 1rpx solid var(--border-color);
  color: var(--text-secondary-color);
  text-align: center;
  font-size: 21rpx;
  font-weight: 800;
}
.plate__actions > view { padding: 18rpx 6rpx; border-right: 1rpx solid var(--border-color); }
.plate__actions > view:last-child { border-right: 0; }
.plate__debate { color: var(--accent-color); }
</style>
