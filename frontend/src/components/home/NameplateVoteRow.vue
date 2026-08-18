<template>
  <view
    class="plate-card"
    :class="{ 'plate-card--supported': supported }"
  >
    <view
      class="plate-card__body"
      role="button"
      :aria-label="`查看铭牌 ${nameplate.display_text}`"
      @tap="openDetail"
    >
      <view class="plate-card__eyebrow">
        {{ nameplate.is_primary ? '主铭牌' : '铭牌' }} · {{ dialectText }}
      </view>
      <view class="plate-card__writing">
        {{ nameplate.display_text }}
      </view>
      <view
        v-if="readingText"
        class="plate-card__reading"
      >
        {{ readingText }}
      </view>
      <view
        v-if="nameplate.definition"
        class="plate-card__definition"
      >
        {{ nameplate.definition }}
      </view>
      <view class="plate-card__source">
        {{ sourceText }} · 点按查看依据
      </view>
    </view>

    <view class="plate-card__actions">
      <view
        class="plate-card__action vote-row__support"
        :class="{ 'plate-card__action--active': supported }"
        role="button"
        @tap.stop="toggle"
      >
        {{ supported ? '已支持' : '支持' }} {{ supportCount }}
      </view>
      <view
        class="plate-card__action plate-card__comment"
        role="button"
        @tap.stop="openComments"
      >
        评论 {{ commentCount }}
      </view>
      <view
        class="plate-card__action plate-card__action--debate"
        role="button"
        @tap.stop="openDebate"
      >
        立论
      </view>
    </view>
  </view>
</template>

<script>
import { requireAuth } from '@/services/authGuard';
import { supportNameplate, unsupportNameplate } from '@/services/guantou';
import {
  goCreateNameplate,
  goNameplateComments,
  goNameplateDetail,
} from '@/services/navigation';

const SOURCE_LABELS = {
  creator: '创作者自述',
  oral: '口述',
  fieldwork: '田野记录',
  book: '书籍',
  article: '论文 / 文章',
  archive: '档案',
  web: '网页',
  other: '其他来源',
};

export default {
  name: 'NameplateVoteRow',
  props: {
    nameplate: {
      type: Object,
      required: true,
    },
    canId: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['support', 'unsupport'],
  data() {
    return {
      supported: Boolean(this.nameplate.supported_by_current_user),
      supportCount: Number(this.nameplate.support_count || 0),
      busy: false,
    };
  },
  computed: {
    dialectText() {
      return this.nameplate.dialect?.name || '方言点待补';
    },
    readingText() {
      const pronunciation = this.nameplate.pronunciation || {};
      const base = pronunciation.base_romanization || '';
      const surface = pronunciation.surface_romanization
        || this.nameplate.pronunciation_text
        || pronunciation.ipa
        || '';
      if (base && surface && base !== surface) return `${base} → ${surface}`;
      return surface || base;
    },
    sourceText() {
      const type = this.nameplate.source_type || this.nameplate.source?.type || 'other';
      const title = this.nameplate.source?.title || this.nameplate.source?.attributed_to;
      return title || SOURCE_LABELS[type] || SOURCE_LABELS.other;
    },
    commentCount() {
      return Number(this.nameplate.comment_count || 0);
    },
  },
  watch: {
    nameplate(next) {
      this.supported = Boolean(next.supported_by_current_user);
      this.supportCount = Number(next.support_count || 0);
    },
  },
  methods: {
    openDetail() {
      goNameplateDetail(this.nameplate.id);
    },
    openComments() {
      goNameplateComments(this.nameplate.id);
    },
    openDebate() {
      // “立论”创建竞争性观点，不代表修订或取代当前铭牌。
      if (!requireAuth('nameplate_create', {
        canId: this.canId,
        nameplateId: this.nameplate.id,
      })) return;
      goCreateNameplate(this.canId, this.nameplate.id);
    },
    async toggle() {
      if (this.busy) return;
      const target = !this.supported;
      if (target && !requireAuth('nameplate_support', {
        nameplateId: this.nameplate.id,
        canId: this.canId,
      })) return;

      this.busy = true;
      this.supported = target;
      this.supportCount += target ? 1 : -1;
      try {
        const response = target
          ? await supportNameplate(this.nameplate.id)
          : await unsupportNameplate(this.nameplate.id);
        if (response && Number.isFinite(Number(response.support_count))) {
          this.supportCount = Number(response.support_count);
          this.supported = Boolean(response.supported_by_current_user);
        }
        this.$emit(target ? 'support' : 'unsupport', this.nameplate.id);
      } catch (error) {
        this.supported = !target;
        this.supportCount += target ? -1 : 1;
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
.plate-card {
  overflow: hidden;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  background: var(--immersive-surface-color);
  backdrop-filter: blur(12rpx);
}

.plate-card__body {
  padding: 22rpx 24rpx 18rpx;
}

.plate-card__eyebrow {
  color: var(--immersive-accent-color);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.plate-card__writing {
  margin-top: 8rpx;
  color: var(--on-immersive-color);
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: 4rpx;
}

.plate-card__reading {
  margin-top: 8rpx;
  color: var(--on-immersive-color);
  font-size: 25rpx;
  letter-spacing: 2rpx;
}

.plate-card__definition {
  margin-top: 10rpx;
  color: var(--on-immersive-muted-color);
  font-size: 23rpx;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.plate-card__source {
  margin-top: 12rpx;
  color: var(--on-immersive-muted-color);
  font-size: 19rpx;
  letter-spacing: 1rpx;
}

.plate-card__actions {
  display: flex;
  gap: 1rpx;
  border-top: 1rpx solid var(--immersive-border-color);
  background: var(--immersive-border-color);
}

.plate-card__action {
  flex: 1;
  padding: 17rpx 8rpx;
  background: var(--immersive-surface-strong-color);
  color: var(--on-immersive-color);
  text-align: center;
  font-size: 21rpx;
  font-weight: 800;
  transition: transform 0.18s ease, background-color 0.25s ease;
}

.plate-card__action:active {
  transform: scale(0.94);
}

.plate-card__action--active,
.plate-card__action--debate {
  background: var(--immersive-accent-color);
  color: var(--immersive-bg-color);
}
</style>
