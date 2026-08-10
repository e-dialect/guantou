<template>
  <view class="page">
    <template v-if="loggedIn">
      <view class="profile">
        <image
          :src="avatar"
          class="avatar"
          mode="aspectFill"
          @tap="toUserInfoPage"
        />
        <view>
          <view class="name">
            {{ nickname || '未登录' }}
          </view>
          <view
            v-if="primaryDialect"
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
      </view>

      <view class="stats">
        <view
          class="stat"
          @tap="toMineCans"
        >
          <view class="number">
            {{ cansCount }}
          </view>
          <view class="label">
            罐头
          </view>
        </view>
        <view class="stat">
          <view class="number">
            {{ flavorsCount }}
          </view>
          <view class="label">
            义项
          </view>
        </view>
        <view class="stat">
          <view class="number">
            {{ nameplatesCount }}
          </view>
          <view class="label">
            铭牌
          </view>
        </view>
      </view>

      <view class="menu">
        <view
          class="menu-item"
          @tap="toCreate"
        >
          装一罐
        </view>
        <view
          class="menu-item"
          @tap="toDrafts"
        >
          草稿箱
          <text class="menu-meta">
            {{ draftsCount }} 条
          </text>
        </view>
        <view
          class="menu-item"
          @tap="toMailsPage"
        >
          我的消息
          <text
            v-if="unreadMailsCount > 0"
            class="badge"
          >
            {{ unreadMailsCount }}
          </text>
        </view>
        <view
          class="menu-item"
          @tap="toUserInfoPage"
        >
          个人资料
        </view>
        <view
          class="menu-item"
          @tap="toChangePasswordPage"
        >
          修改密码
        </view>
        <view
          class="menu-item"
          @tap="bindingWechat"
        >
          {{ wechatBindText }}
        </view>
        <view
          class="menu-item danger"
          @tap="exit"
        >
          退出登录
        </view>
      </view>
    </template>

    <view
      v-else
      class="guest-profile"
    >
      <view class="guest-mark">
        乡
      </view>
      <view class="guest-title">
        还没有登录
      </view>
      <view class="guest-copy">
        登录后可以查看自己的罐头、草稿和贡献记录。查词与收听公开乡音无需登录。
      </view>
      <button
        class="login-button"
        @tap="openLoginFromMine"
      >
        登录 / 注册
      </button>
      <button
        class="search-button"
        @tap="toSearch"
      >
        先去查词
      </button>
    </view>
  </view>
</template>

<script>
import { toIndexPage } from '@/routers';
import {
  bindingWechat as bindingWechatService,
  cancelBindingWechat as cancelBindingWechatService,
  clearUserInfo,
  getUserInfo,
} from '@/services/user';
import {
  toChangePasswordPage,
  toUserInfoPage,
} from '@/routers/user';
import { toMailsPage } from '@/routers/mail';
import { listCanDrafts } from '@/services/canDrafts';
import { openLoginFromMine } from '@/services/authJourney';

const app = getApp();

export default {
  data() {
    return {
      id: '',
      avatar: '',
      nickname: '',
      primaryDialect: null,
      cansCount: 0,
      flavorsCount: 0,
      nameplatesCount: 0,
      draftsCount: 0,
      unreadMailsCount: 0,
      wechatBindText: '绑定微信',
      isBinding: false,
      loggedIn: Boolean(uni.getStorageSync('token')),
    };
  },
  computed: {
    locationText() {
      return this.primaryDialect?.qualified_code || '未填写方言点';
    },
  },
  beforeMount() {
    this.getInfo();
  },
  onShow() {
    this.loggedIn = Boolean(uni.getStorageSync('token'));
    this.refreshDraftsCount();
    if (this.loggedIn) this.getInfo();
  },
  methods: {
    toMailsPage,
    toChangePasswordPage,
    toUserInfoPage,
    openLoginFromMine,
    toSearch() {
      uni.navigateTo({ url: '/pages/search' });
    },
    toCreate() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    toDrafts() {
      uni.navigateTo({ url: '/pages/cans/drafts' });
    },
    refreshDraftsCount() {
      this.draftsCount = listCanDrafts().length;
    },
    toMineCans() {
      uni.navigateTo({ url: '/pages/cans/index?mine=true' });
    },
    async getInfo() {
      if (!app.globalData.id) return;
      const userInfo = await getUserInfo(app.globalData.id);
      this.id = userInfo.user.id;
      this.avatar = userInfo.user.avatar;
      this.nickname = userInfo.user.nickname || userInfo.user.username;
      this.primaryDialect = userInfo.user.primary_dialect;
      this.cansCount = userInfo.contribution.cans_uploaded || 0;
      this.flavorsCount = userInfo.contribution.flavors_uploaded || 0;
      this.nameplatesCount = userInfo.contribution.nameplates || 0;
      this.unreadMailsCount = userInfo.notification
        ? userInfo.notification.statistics.unread
        : 0;
      this.wechatBindText = userInfo.user.wechat ? '解绑微信' : '绑定微信';
    },
    exit() {
      uni.showModal({
        content: '是否退出当前登录？',
        success: async (res) => {
          if (res.confirm) {
            clearUserInfo();
            await toIndexPage(uni.getSystemInfoSync().uniPlatform === 'web');
            uni.showToast({ title: '登出成功' });
          }
        },
      });
    },
    async bindingWechat() {
      if (this.isBinding || !app.globalData.id) return;
      this.isBinding = true;
      try {
        const userInfo = await getUserInfo(app.globalData.id);
        if (!userInfo.user.wechat) {
          // #ifndef MP-WEIXIN
          uni.showToast({ title: '请在微信小程序中绑定微信', icon: 'none' });
          // #endif
          // #ifdef MP-WEIXIN
          await bindingWechatService(app.globalData.id, false);
          uni.showToast({ title: '绑定成功' });
          // #endif
        } else {
          await cancelBindingWechatService(app.globalData.id);
          uni.showToast({ title: '解绑成功' });
        }
        await this.getInfo();
      } catch (err) {
        const msg = (err && err.message) || '操作失败';
        uni.showToast({ title: msg, icon: 'none' });
      } finally {
        this.isBinding = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
  padding: 44rpx 28rpx 80rpx;
  box-sizing: border-box;
}

.guest-profile {
  max-width: 620rpx;
  margin: 16vh auto 0;
  padding: 48rpx 36rpx;
  border: 1px solid #dce3d8;
  border-radius: 18rpx;
  background: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.guest-mark {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto;
  border-radius: 56rpx;
  background: #1f5c43;
  color: #ffffff;
  font-size: 48rpx;
  font-weight: 800;
  line-height: 112rpx;
}

.guest-title {
  margin-top: 28rpx;
  font-size: 38rpx;
  font-weight: 800;
}

.guest-copy {
  margin-top: 16rpx;
  color: #647068;
  font-size: 26rpx;
  line-height: 1.65;
}

.login-button,
.search-button {
  margin-top: 30rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.login-button {
  background: #1f5c43;
  color: #ffffff;
}

.search-button {
  margin-top: 16rpx;
  border: 1px solid #ccd7ca;
  background: #ffffff;
  color: #1f5c43;
}

.login-button::after,
.search-button::after {
  border: 0;
}

.profile {
  display: flex;
  align-items: center;
  gap: 22rpx;
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

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 30rpx;
}

.stat,
.menu {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
}

.stat {
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

.menu {
  margin-top: 28rpx;
  overflow: hidden;
}

.menu-item {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx;
  border-bottom: 1px solid #eef1eb;
}

.menu-item:last-child {
  border-bottom: 0;
}

.danger {
  color: #9b3a2d;
}

.badge {
  min-width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  color: #fff;
  background: #9b3a2d;
  border-radius: 18rpx;
  font-size: 22rpx;
}

.menu-meta {
  color: #6c776e;
  font-size: 26rpx;
}
</style>
