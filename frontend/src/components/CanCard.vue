<template>
  <view
    class="can-card"
    @tap="$emit('open', can.id)"
  >
    <view class="card-head">
      <text class="label">
        {{ primaryText }}
      </text>
      <text class="status">
        {{ statusText(can.status) }}
      </text>
    </view>
    <view
      v-if="social && can.recorder"
      class="author-row"
      @tap.stop="$emit('author', can.recorder.id)"
    >
      <image
        class="author-avatar"
        :src="can.recorder.avatar"
        mode="aspectFill"
      />
      <text class="author-name">
        {{ can.recorder.nickname || can.recorder.username }}
      </text>
      <text class="author-action">
        查看作者 ›
      </text>
    </view>
    <view class="concept">
      {{ can.concept_text || '未填写普通话概念' }}
    </view>
    <view class="meta">
      {{ locationText }} · {{ nameplateCount }} 张铭牌 · {{ can.views || 0 }} 次查看
    </view>
    <button
      class="play-button"
      :disabled="!can.audio_url"
      @tap.stop="play"
    >
      <text class="play-icon">
        ▶
      </text>
      <text>{{ can.audio_url ? `听乡音${durationText}` : '暂无可播放音频' }}</text>
    </button>
    <view
      v-if="social"
      class="social-actions"
    >
      <button
        class="social-button"
        :class="{ active: liked }"
        :disabled="likeBusy"
        @tap.stop="toggleLike"
      >
        {{ liked ? '♥' : '♡' }} {{ likeCount }}
      </button>
      <button
        class="social-button"
        @tap.stop="$emit('comment', can.id)"
      >
        评论 {{ can.comment_count || 0 }}
      </button>
      <button
        class="social-button"
        @tap.stop="useSame"
      >
        同款 {{ can.use_count || 0 }}
      </button>
      <button
        class="social-button"
        open-type="share"
        @tap.stop="share"
      >
        分享
      </button>
    </view>
    <view
      v-if="ownerActions"
      class="owner-actions"
    >
      <button @tap.stop="useSame">
        用同款
      </button>
      <button
        class="danger"
        @tap.stop="$emit('delete', can)"
      >
        删除
      </button>
    </view>
  </view>
</template>

<script>
import { playAudio } from '@/utils/audio';
import { requireAuth } from '@/services/authGuard';
import { likeCan, unlikeCan } from '@/services/canSocial';
import { startUseSame } from '@/services/canPostJourney';
import { shareCanOnWeb } from '@/utils/shareCan';
import { dialectCardLabel } from '@/utils/dialectTree';

const statusLabels = {
  unlabeled: '无铭牌',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '有争议',
  rejected: '已驳回',
};

export default {
  name: 'CanCard',
  props: {
    can: {
      type: Object,
      required: true,
    },
    social: {
      type: Boolean,
      default: false,
    },
    ownerActions: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['author', 'comment', 'delete', 'open', 'reuse', 'share'],
  data() {
    return {
      likeBusy: false,
      liked: Boolean(this.can.liked_by_me),
      likeCount: Number(this.can.like_count || 0),
    };
  },
  computed: {
    primaryText() {
      return this.can.primary_nameplate
        ? this.can.primary_nameplate.display_text
        : '等待铭牌';
    },
    locationText() {
      return dialectCardLabel(this.can.submitted_dialect);
    },
    nameplateCount() {
      return this.can.nameplate_count || 0;
    },
    durationText() {
      const durationMs = Number(this.can.duration_ms || 0);
      if (!durationMs) return '';
      return ` · ${Math.max(1, Math.round(durationMs / 1000))} 秒`;
    },
  },
  methods: {
    play() {
      playAudio(this.can.audio_url);
    },
    statusText(status) {
      return statusLabels[status] || status || '未知';
    },
    async toggleLike() {
      if (!requireAuth('like', { page: 'can_detail', canId: this.can.id })) return;
      if (this.likeBusy) return;
      this.likeBusy = true;
      try {
        const response = this.liked
          ? await unlikeCan(this.can.id)
          : await likeCan(this.can.id);
        this.liked = response.liked;
        this.likeCount = response.like_count;
      } finally {
        this.likeBusy = false;
      }
    },
    async share() {
      this.$emit('share', this.can);
      // #ifdef H5
      await shareCanOnWeb(this.can);
      // #endif
    },
    useSame() {
      this.$emit('reuse', this.can.id);
      startUseSame(this.can.id, { page: 'can_feed' });
    },
  },
};
</script>

<style scoped>
.can-card {
  background: var(--dress-card-background, var(--surface-color));
  border:
    var(--dress-card-border-width, 1px)
    solid var(--dress-card-border-color, var(--border-color));
  border-radius: var(--dress-card-border-radius, var(--radius-md));
  box-shadow: var(--dress-card-shadow, none);
  padding: var(--dress-card-padding, var(--space-3));
  margin-bottom: 18rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.label {
  min-width: 0;
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.status {
  flex: 0 0 auto;
  font-size: var(--font-size-xs);
  color: var(--accent-color);
  background: var(--accent-subtle-color);
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
}

.concept {
  margin-top: 14rpx;
  color: var(--text-secondary-color);
}

.author-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 18rpx;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.author-avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.author-name {
  min-width: 0;
  flex: 1;
  font-weight: 700;
}

.author-action {
  color: var(--muted-color);
}

.meta {
  margin-top: 14rpx;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.play-button {
  width: 100%;
  min-height: 68rpx;
  margin: 20rpx 0 0;
  padding: 0 20rpx;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--accent-color);
  font-size: 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.play-button::after {
  border: 0;
}

.play-button[disabled] {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  border-color: var(--border-color);
}

.play-icon {
  font-size: 20rpx;
}

.social-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10rpx;
  margin-top: 16rpx;
}

.owner-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 16rpx;
}

.owner-actions button {
  width: auto;
  margin: 0;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 60rpx;
}

.owner-actions button.danger {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.owner-actions button::after {
  border: 0;
}

.social-button {
  min-width: 0;
  margin: 0;
  padding: 0 10rpx;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  line-height: 62rpx;
}

.social-button.active {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.social-button::after {
  border: 0;
}
</style>
