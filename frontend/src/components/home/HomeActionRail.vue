<template>
  <view class="action-rail">
    <!-- 作者头像 + 关注角标 -->
    <view
      class="action-rail__author"
      @tap="openAuthor"
    >
      <image
        v-if="authorAvatar"
        class="action-rail__avatar"
        :src="authorAvatar"
        mode="aspectFill"
      />
      <view
        v-else
        class="action-rail__avatar action-rail__avatar--ghost"
      />
      <view
        class="action-rail__follow"
        :class="{ 'action-rail__follow--done': following }"
        :aria-label="following ? '已关注作者' : '关注作者'"
        @tap.stop="toggleFollow"
      >
        <view
          v-if="following"
          class="action-rail__check"
          aria-hidden="true"
        />
        <view
          v-else
          class="action-rail__plus"
          aria-hidden="true"
        />
      </view>
    </view>

    <!-- 赞 -->
    <view
      class="action-rail__item"
      role="button"
      aria-label="点赞"
      @tap="toggleLike"
    >
      <view
        class="action-rail__bubble"
        :class="{ 'action-rail__bubble--liked': liked }"
      >
        <text class="action-rail__heart">
          {{ liked ? '♥' : '♡' }}
        </text>
      </view>
      <text class="action-rail__count">
        {{ formatCount(likeCount) }}
      </text>
    </view>

    <!-- 评论 -->
    <view
      class="action-rail__item"
      role="button"
      aria-label="评论"
      @tap="openComments"
    >
      <view class="action-rail__bubble">
        <view
          class="action-rail__comment-icon"
          aria-hidden="true"
        />
      </view>
      <text class="action-rail__count">
        {{ formatCount(can.comment_count || 0) }}
      </text>
    </view>

    <!-- 分享 -->
    <button
      class="action-rail__share-button"
      open-type="share"
      aria-label="分享"
      @tap="share"
    >
      <view class="action-rail__bubble">
        <view
          class="action-rail__share-icon"
          aria-hidden="true"
        />
      </view>
      <text class="action-rail__count">
        分享
      </text>
    </button>
  </view>
</template>

<script>
import { requireAuth } from '@/services/authGuard';
import { likeCan, unlikeCan } from '@/services/canSocial';
import { followUser, unfollowUser } from '@/services/following';
import { toUserPage } from '@/routers/user';
import { shareCanOnWeb } from '@/utils/shareCan';
import { goCanComments } from '@/services/navigation';

export default {
  name: 'HomeActionRail',
  props: {
    can: {
      type: Object,
      required: true,
    },
  },
  emits: ['share'],
  data() {
    return {
      liked: Boolean(this.can.liked_by_me),
      likeCount: Number(this.can.like_count || 0),
      likeBusy: false,
      following: Boolean(this.can.recorder_followed_by_me),
      followBusy: false,
    };
  },
  computed: {
    authorAvatar() {
      return this.can.recorder ? this.can.recorder.avatar : '';
    },
  },
  watch: {
    can(next) {
      this.liked = Boolean(next.liked_by_me);
      this.likeCount = Number(next.like_count || 0);
      this.following = Boolean(next.recorder_followed_by_me);
    },
  },
  methods: {
    formatCount(value) {
      const count = Number(value || 0);
      if (count >= 10000) return `${(count / 10000).toFixed(1)}w`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
      return String(count);
    },
    openAuthor() {
      if (this.can.recorder && this.can.recorder.id) {
        toUserPage(this.can.recorder.id);
      }
    },
    async toggleFollow() {
      if (this.followBusy || !this.can.recorder) return;
      // 作者即本人时不提供关注自己。
      const myId = uni.getStorageSync('id');
      if (myId && Number(this.can.recorder.id) === Number(myId)) return;
      if (!requireAuth('follow', { page: 'home_feed', canId: this.can.id })) return;
      this.followBusy = true;
      const target = !this.following;
      this.following = target;
      try {
        if (target) {
          await followUser(this.can.recorder.id);
        } else {
          await unfollowUser(this.can.recorder.id);
        }
      } catch (error) {
        this.following = !target;
      } finally {
        this.followBusy = false;
      }
    },
    async toggleLike() {
      if (!requireAuth('like', { page: 'home_feed', canId: this.can.id })) return;
      if (this.likeBusy) return;
      this.likeBusy = true;
      const target = !this.liked;
      this.liked = target;
      this.likeCount += target ? 1 : -1;
      try {
        const response = target ? await likeCan(this.can.id) : await unlikeCan(this.can.id);
        if (response && Number.isFinite(Number(response.like_count))) {
          this.liked = Boolean(response.liked);
          this.likeCount = Number(response.like_count);
        }
      } catch (error) {
        this.liked = !target;
        this.likeCount += target ? -1 : 1;
      } finally {
        this.likeBusy = false;
      }
    },
    openComments() {
      if (!requireAuth('comment', { page: 'home_feed', canId: this.can.id })) return;
      goCanComments(this.can.id);
    },
    async share() {
      this.$emit('share', this.can);
      // #ifdef H5
      await shareCanOnWeb(this.can);
      // #endif
    },
  },
};
</script>

<style scoped>
.action-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 34rpx;
}

/* ---------- 头像与关注 ---------- */
.action-rail__author {
  position: relative;
  margin-bottom: 8rpx;
}

.action-rail__avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 3rpx solid var(--on-immersive-color);
  background: var(--immersive-surface-color);
}

.action-rail__avatar--ghost {
  opacity: 0.5;
}

.action-rail__follow {
  position: absolute;
  left: 50%;
  bottom: -18rpx;
  transform: translateX(-50%);
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: var(--immersive-accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.25s ease, transform 0.18s ease;
}

.action-rail__follow:active {
  transform: translateX(-50%) scale(0.88);
}

.action-rail__follow--done {
  background: var(--immersive-surface-strong-color);
  border: 1rpx solid var(--immersive-border-color);
}

/* 纯 CSS 加号 */
.action-rail__plus {
  position: relative;
  width: 20rpx;
  height: 20rpx;
}

.action-rail__plus::before,
.action-rail__plus::after {
  content: '';
  position: absolute;
  background: var(--immersive-bg-color);
  border-radius: 2rpx;
}

.action-rail__plus::before {
  left: 8rpx;
  top: 0;
  width: 4rpx;
  height: 20rpx;
}

.action-rail__plus::after {
  left: 0;
  top: 8rpx;
  width: 20rpx;
  height: 4rpx;
}

/* 纯 CSS 对勾 */
.action-rail__check {
  width: 16rpx;
  height: 8rpx;
  border-left: 4rpx solid var(--on-immersive-color);
  border-bottom: 4rpx solid var(--on-immersive-color);
  transform: rotate(-45deg);
  margin-top: -4rpx;
}

/* ---------- 互动项 ---------- */
.action-rail__item,
.action-rail__share-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.action-rail__share-button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: normal;
  font-size: inherit;
}

.action-rail__share-button::after {
  border: 0;
}

.action-rail__bubble {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background: var(--immersive-surface-color);
  border: 1rpx solid var(--immersive-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, background-color 0.25s ease, border-color 0.25s ease;
}

.action-rail__item:active .action-rail__bubble {
  transform: scale(0.88);
}

.action-rail__bubble--liked {
  background: var(--immersive-surface-strong-color);
  border-color: var(--immersive-accent-color);
}

.action-rail__heart {
  font-size: 42rpx;
  line-height: 1;
  color: var(--immersive-icon-color);
}

.action-rail__bubble--liked .action-rail__heart {
  color: var(--immersive-accent-color);
}

.action-rail__count {
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1rpx;
}

/* 纯 CSS 气泡图标 */
.action-rail__comment-icon {
  position: relative;
  width: 40rpx;
  height: 32rpx;
  border: 4rpx solid var(--immersive-icon-color);
  border-radius: 16rpx;
  box-sizing: border-box;
}

.action-rail__comment-icon::after {
  content: '';
  position: absolute;
  left: 6rpx;
  bottom: -10rpx;
  width: 0;
  height: 0;
  border-top: 10rpx solid var(--immersive-icon-color);
  border-left: 10rpx solid transparent;
}

/* 纯 CSS 转发箭头 */
.action-rail__share-icon {
  position: relative;
  width: 40rpx;
  height: 34rpx;
}

.action-rail__share-icon::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 30rpx;
  height: 24rpx;
  border: 4rpx solid var(--immersive-icon-color);
  border-top: 0;
  border-radius: 0 0 10rpx 10rpx;
  box-sizing: border-box;
}

.action-rail__share-icon::after {
  content: '';
  position: absolute;
  right: 2rpx;
  top: 0;
  width: 14rpx;
  height: 14rpx;
  border-top: 4rpx solid var(--immersive-icon-color);
  border-right: 4rpx solid var(--immersive-icon-color);
  transform: rotate(12deg);
}
</style>
