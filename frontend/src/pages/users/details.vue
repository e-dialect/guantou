<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text>
      <text class="title">
        用户
      </text>
    </view>
    <view class="profile">
      <image
        class="avatar"
        :src="userInfo.user.avatar"
        mode="aspectFill"
      />
      <view>
        <view class="name">
          {{ userInfo.user.nickname || userInfo.user.username }}
        </view>
        <view
          v-if="userInfo.user.primary_dialect"
          class="dialect-badge"
        >
          {{ locationText }}
        </view>
        <view
          v-else
          class="meta"
        >
          未填写方言点
        </view>
      </view>
      <button
        v-if="!isSelf"
        class="follow-button"
        :class="{ following: userInfo.user.is_following }"
        :disabled="followingBusy"
        @tap="toggleFollow"
      >
        {{ userInfo.user.is_following ? '已关注' : '关注' }}
      </button>
    </view>
    <view class="social-stats">
      <text>{{ userInfo.user.follower_count }} 位关注者</text>
      <text>{{ userInfo.user.following_count }} 个关注</text>
    </view>
    <view class="stats">
      <view class="stat">
        <view class="number">
          {{ userInfo.contribution.cans_uploaded }}
        </view>
        <view class="label">
          罐头
        </view>
      </view>
      <view class="stat">
        <view class="number">
          {{ userInfo.contribution.flavors_uploaded }}
        </view>
        <view class="label">
          义项
        </view>
      </view>
      <view class="stat">
        <view class="number">
          {{ userInfo.contribution.nameplates }}
        </view>
        <view class="label">
          铭牌
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getUserInfo } from '@/services/user';
import { APP_NAME } from '@/const/branding';
import { defaultMessage } from '@/services/shareMessages';
import { requireAuth } from '@/services/authGuard';
import { followUser, unfollowUser } from '@/services/following';

export default {
  data() {
    return {
      id: 0,
      userInfo: {
        user: {
          avatar: '',
          nickname: '',
          username: '',
          primary_dialect: null,
          follower_count: 0,
          following_count: 0,
          is_following: false,
        },
        contribution: {
          cans_uploaded: 0,
          flavors_uploaded: 0,
          nameplates: 0,
        },
      },
      followingBusy: false,
    };
  },
  computed: {
    locationText() {
      return this.userInfo.user.primary_dialect?.qualified_code || '未填写方言点';
    },
    isSelf() {
      return Number(uni.getStorageSync('id')) === Number(this.id);
    },
  },
  async onLoad(options) {
    this.id = options.id;
    await this.getInfo(options.id);
  },
  onShareAppMessage() {
    return {
      title: `${APP_NAME}用户`,
      path: `/pages/users/details?id=${this.id}`,
      ...defaultMessage(),
    };
  },
  methods: {
    async getInfo(id) {
      this.userInfo = await getUserInfo(id);
    },
    async toggleFollow() {
      if (!requireAuth('follow', { page: 'user_detail', userId: this.id })) return;
      if (this.followingBusy) return;
      this.followingBusy = true;
      const wasFollowing = this.userInfo.user.is_following;
      try {
        if (wasFollowing) {
          await unfollowUser(this.id);
        } else {
          await followUser(this.id);
        }
        this.userInfo.user.is_following = !wasFollowing;
        this.userInfo.user.follower_count = Math.max(
          0,
          Number(this.userInfo.user.follower_count || 0) + (wasFollowing ? -1 : 1),
        );
      } catch (error) {
        uni.showToast({ title: '关注状态更新失败', icon: 'none' });
      } finally {
        this.followingBusy = false;
      }
    },
    goBack() {
      uni.navigateBack();
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.topbar {
  height: 96rpx;
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  background: #fff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 54rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.profile {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 34rpx 28rpx;
}

.profile > view:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 64rpx;
  background: #dfe5da;
}

.name {
  font-size: 38rpx;
  font-weight: 800;
}

.meta {
  margin-top: 8rpx;
  color: #6c776e;
}

.dialect-badge {
  display: inline-flex;
  margin-top: 10rpx;
  padding: 7rpx 16rpx;
  border-radius: 999rpx;
  background: #e4eee5;
  color: #285e45;
  font-size: 23rpx;
}

.follow-button {
  width: 138rpx;
  margin: 0;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 26rpx;
  line-height: 66rpx;
}

.follow-button.following {
  border: 1px solid #cad7cc;
  background: #fff;
  color: #526158;
}

.follow-button::after {
  border: 0;
}

.social-stats {
  display: flex;
  gap: 28rpx;
  padding: 0 28rpx 28rpx 178rpx;
  color: #68756d;
  font-size: 24rpx;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding: 0 28rpx;
}

.stat {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx 12rpx;
  text-align: center;
}

.number {
  font-size: 38rpx;
  font-weight: 800;
  color: #1f5c43;
}

.label {
  margin-top: 8rpx;
  color: #6c776e;
}
</style>
