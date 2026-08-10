<template>
  <view class="login-page">
    <cu-custom title="登录" />
    <view
      v-if="intentText"
      class="intent-banner"
    >
      <view class="intent-kicker">
        {{ intentVoluntary ? '继续访问' : '登录后继续' }}
      </view>
      <view class="intent-copy">
        {{ intentText }}
      </view>
    </view>
    <view class="logo">
      <image
        :src="logo"
        mode="widthFix"
      />
    </view>
    <form @submit="login">
      <view class="info">
        <view class="cuIcon-friend" />
        <input
          name="username"
          placeholder="请输入用户名"
        >
      </view>
      <view class="info">
        <view class="cuIcon-lock" />
        <input
          name="password"
          password
          placeholder="请输入密码"
        >
      </view>
      <view class="flex justify-center">
        <button
          class="cu-btn round bg-gradual-blue shadow text-df margin-top"
          form-type="submit"
          style="width: 65vw"
        >
          登录
        </button>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="flex justify-center">
        <button
          class="cu-btn round bg-gradual-blue shadow text-df margin-top"
          style="width: 65vw"
          @tap="mpLogin()"
        >
          微信一键登录
        </button>
      </view>
      <!-- #endif -->
    </form>
    <button
      class="browse-first"
      @tap="cancelLoginToSearch"
    >
      暂不登录，先去查词
    </button>
    <view
      class="flex text-bold text-center login-links"
    >
      <view
        class="flex-sub solid-right"
        @tap="toForgetPage()"
      >
        忘记密码
      </view>
      <!-- #ifndef MP-WEIXIN -->
      <view
        class="flex-sub solid-right"
        @tap="toRegisterPage()"
      >
        用户注册
      </view>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view
        class="flex-sub"
        @tap="toWechatRegisterPage()"
      >
        微信注册
      </view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script>
import { COS_URL } from '@/const/urls';
import { actionLabel, peekInterceptIntent } from '@/services/authGuard';
import { cancelLoginToSearch } from '@/services/authJourney';
import { mpLogin, normalLogin } from '@/services/login';
import { toForgetPage, toRegisterPage, toWechatRegisterPage } from '@/routers/login';
import CuCustom from '@/colorui/components/cu-custom.vue';

export default {
  components: { CuCustom },
  data() {
    return {
      toForgetPage,
      toRegisterPage,
      toWechatRegisterPage,
      logo: `${COS_URL}/images/logo.png`,
      intent: null,
    };
  },
  computed: {
    intentVoluntary() {
      return Boolean(this.intent?.voluntary);
    },
    intentText() {
      if (!this.intent) return '';
      if (this.intentVoluntary) return '验证身份后返回「我的」。';
      return `你刚才想${actionLabel(this.intent.action)}，验证身份后会回到原来的位置。`;
    },
  },
  onLoad() {
    this.intent = peekInterceptIntent();
  },
  methods: {
    mpLogin,
    cancelLoginToSearch,
    login(e) {
      const { username } = e.detail.value;
      const { password } = e.detail.value;
      normalLogin(username, password);
    },
  },
};
</script>
<style scoped>
page {
  background-color: #ffffff;
}

.login-page {
  min-height: 100vh;
  background: #f7f8f4;
  color: #1d2a24;
  padding-bottom: 60rpx;
  box-sizing: border-box;
}

.intent-banner {
  margin: 28rpx 34rpx 0;
  padding: 22rpx 24rpx;
  border: 1px solid #d6e2d3;
  border-left: 8rpx solid #1f5c43;
  border-radius: 12rpx;
  background: #f0f6ed;
}

.intent-kicker {
  color: #1f5c43;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.intent-copy {
  margin-top: 8rpx;
  color: #4f6055;
  font-size: 26rpx;
  line-height: 1.5;
}

.logo {
  margin-top: 8vh;
  margin-bottom: 4vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo image {
  width: 40vw;
  height: 40vw;
}

.info {
  background-color: transparent;
  padding: 1rpx 30rpx;
  display: flex;
  align-items: center;
  min-height: 100rpx;
  justify-content: center;
  margin-bottom: 16px;
}

.info input {
  color: #555;
  background-color: #f5f5f5;
  height: 80rpx;
  width: 60vw;
  padding-left: 20rpx;
  border-radius: 10rpx;
  font-size: 32rpx;
  margin-left: 16px;
}

.browse-first {
  width: 65vw;
  margin: 28rpx auto 0;
  border: 1px solid #cbd7ca;
  border-radius: 999rpx;
  background: #ffffff;
  color: #1f5c43;
  font-size: 27rpx;
}

.browse-first::after {
  border: 0;
}

.login-links {
  margin-top: 10vh;
}

.info > text[class*='cuIcon-'] {
  font-size: 40rpx;
  box-sizing: border-box;
}

</style>
