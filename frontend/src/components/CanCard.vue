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
      return this.can.submitted_dialect?.qualified_code || '未标方言点';
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
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 12rpx;
  padding: 24rpx;
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
  font-size: 24rpx;
  color: #1f5c43;
  background: #e8f1eb;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.concept {
  margin-top: 14rpx;
  color: #33463b;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 18rpx;
  color: #58675e;
  font-size: 24rpx;
}

.author-avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #e6ebe3;
}

.author-name {
  min-width: 0;
  flex: 1;
  font-weight: 700;
}

.author-action {
  color: #7d897f;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}

.play-button {
  width: 100%;
  min-height: 68rpx;
  margin: 20rpx 0 0;
  padding: 0 20rpx;
  border: 1px solid #cbd8cb;
  border-radius: 999rpx;
  background: #f4f8f3;
  color: #1f5c43;
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
  background: #f2f3ef;
  color: #899289;
  border-color: #e2e5df;
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
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #edf4ea;
  color: #1f5c43;
  font-size: 24rpx;
  line-height: 60rpx;
}

.owner-actions button.danger {
  background: #fff1ed;
  color: #9b3a2d;
}

.owner-actions button::after {
  border: 0;
}

.social-button {
  min-width: 0;
  margin: 0;
  padding: 0 10rpx;
  border: 0;
  border-radius: 10rpx;
  background: #f2f4ef;
  color: #59665e;
  font-size: 24rpx;
  line-height: 62rpx;
}

.social-button.active {
  background: #f7e9e5;
  color: #9a3f31;
}

.social-button::after {
  border: 0;
}
</style>
