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
        <view class="meta">
          {{ locationText }}
        </view>
      </view>
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

export default {
  data() {
    return {
      id: 0,
      userInfo: {
        user: {
          avatar: '',
          nickname: '',
          username: '',
          county: '',
          town: '',
        },
        contribution: {
          cans_uploaded: 0,
          flavors_uploaded: 0,
          nameplates: 0,
        },
      },
    };
  },
  computed: {
    locationText() {
      return [this.userInfo.user.county, this.userInfo.user.town]
        .filter(Boolean)
        .join(' / ') || '未填写方言点';
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
