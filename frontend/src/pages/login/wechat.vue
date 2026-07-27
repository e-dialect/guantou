<template>
  <view class="page">
    <cu-custom title="微信登录" />

    <view class="hero">
      <image
        :src="logo"
        class="logo"
        mode="aspectFit"
      />
      <view class="title">
        微信一键登录
      </view>
      <view class="desc">
        使用微信授权快速进入方言罐头，继续查看贡献、消息和个人资料。
      </view>
    </view>

    <view class="panel">
      <view class="wechat-row">
        <text class="cuIcon-weixin icon" />
        <view class="wechat-copy">
          <view class="row-title">
            当前微信账号
          </view>
          <view class="row-desc">
            未绑定账号时，可按提示一键注册并自动登录。
          </view>
        </view>
      </view>

      <button
        class="cu-btn round bg-gradual-blue shadow text-df login-btn"
        @tap="handleWechatLogin"
      >
        微信一键登录
      </button>

      <button
        class="cu-btn round line-green text-df home-btn"
        @tap="goHome"
      >
        进入主页面
      </button>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <view class="footer">
      <text @tap="toWechatRegisterPage">
        微信注册
      </text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script>
import { COS_URL } from '@/const/urls';
import { mpLogin } from '@/services/login';
import { toWechatRegisterPage } from '@/routers/login';
import { toIndexPage } from '@/routers/index';
import CuCustom from '@/colorui/components/cu-custom.vue';

export default {
  components: { CuCustom },
  data() {
    return {
      logo: `${COS_URL}/images/logo.png`,
    };
  },
  methods: {
    handleWechatLogin() {
      if (uni.getSystemInfoSync().uniPlatform === 'web') {
        uni.showToast({
          title: '请在微信小程序中使用微信登录',
          icon: 'none',
        });
        return;
      }
      mpLogin();
    },
    goHome() {
      toIndexPage(true);
    },
    toWechatRegisterPage,
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
  padding: 42rpx 28rpx 80rpx;
  box-sizing: border-box;
}

.hero {
  padding-top: 80rpx;
  text-align: center;
}

.logo {
  width: 180rpx;
  height: 180rpx;
}

.title {
  margin-top: 32rpx;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.2;
}

.desc {
  margin: 18rpx auto 0;
  max-width: 560rpx;
  color: #5d6b61;
  font-size: 28rpx;
  line-height: 1.7;
}

.panel {
  margin-top: 58rpx;
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 16rpx;
  padding: 34rpx 28rpx 38rpx;
  box-sizing: border-box;
}

.wechat-row {
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.icon {
  width: 76rpx;
  height: 76rpx;
  line-height: 76rpx;
  text-align: center;
  color: #fff;
  background: #1f5c43;
  border-radius: 38rpx;
  font-size: 42rpx;
  flex-shrink: 0;
}

.wechat-copy {
  flex: 1;
}

.row-title {
  font-size: 32rpx;
  font-weight: 800;
}

.row-desc {
  margin-top: 8rpx;
  color: #7a867d;
  font-size: 25rpx;
  line-height: 1.5;
}

.login-btn {
  width: 100%;
  margin-top: 40rpx;
}

.home-btn {
  width: 100%;
  margin-top: 22rpx;
}

.footer {
  margin-top: 36rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1f5c43;
  font-size: 27rpx;
}
</style>
