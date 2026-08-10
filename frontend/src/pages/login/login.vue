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
    <form
      class="phone-form"
      @submit="phoneLogin"
    >
      <view class="info">
        <view class="cuIcon-mobile" />
        <input
          v-model="phone"
          inputmode="numeric"
          maxlength="13"
          name="phone"
          placeholder="请输入手机号"
        >
      </view>
      <view class="info code-row">
        <view class="cuIcon-lock" />
        <input
          v-model="code"
          inputmode="numeric"
          maxlength="6"
          name="code"
          placeholder="请输入验证码"
        >
        <button
          :disabled="countdown > 0 || sendingCode"
          class="code-button"
          @tap="sendPhoneCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>
      <view
        v-if="demoCode"
        class="demo-code"
      >
        Demo 验证码：<text>{{ demoCode }}</text>
      </view>
      <view class="flex justify-center">
        <button
          class="cu-btn round bg-gradual-blue shadow text-df margin-top"
          form-type="submit"
          style="width: 65vw"
        >
          登录 / 注册
        </button>
      </view>
    </form>
    <!-- #ifdef MP-WEIXIN -->
    <view class="flex justify-center">
      <button
        class="cu-btn round bg-gradual-blue shadow text-df margin-top"
        style="width: 65vw"
        @tap="mpLogin()"
      >
        微信一键登录 / 注册
      </button>
    </view>
    <!-- #endif -->
    <button
      class="password-toggle"
      @tap="showPasswordLogin = !showPasswordLogin"
    >
      {{ showPasswordLogin ? '收起账号密码登录' : '使用账号密码登录' }}
    </button>
    <form
      v-if="showPasswordLogin"
      class="password-form"
      @submit="passwordLogin"
    >
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
          class="cu-btn round line-green text-df"
          form-type="submit"
          style="width: 65vw"
        >
          账号密码登录
        </button>
      </view>
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
import { loginWithPhone, requestPhoneCode } from '@/services/phoneAuth';
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
      phone: '',
      code: '',
      demoCode: '',
      countdown: 0,
      countdownTimer: null,
      sendingCode: false,
      showPasswordLogin: false,
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
  onUnload() {
    this.clearCountdown();
  },
  methods: {
    mpLogin,
    cancelLoginToSearch,
    clearCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    },
    startCountdown(seconds) {
      this.clearCountdown();
      this.countdown = Number(seconds) || 60;
      this.countdownTimer = setInterval(() => {
        this.countdown -= 1;
        if (this.countdown <= 0) this.clearCountdown();
      }, 1000);
    },
    async sendPhoneCode() {
      if (this.countdown > 0 || this.sendingCode) return;
      this.sendingCode = true;
      try {
        const response = await requestPhoneCode(this.phone);
        this.demoCode = response.demo_code || '';
        this.startCountdown(response.retry_after);
        uni.showToast({ title: '验证码已生成', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '验证码发送失败', icon: 'none' });
      } finally {
        this.sendingCode = false;
      }
    },
    async phoneLogin() {
      try {
        await loginWithPhone(this.phone, this.code);
      } catch (error) {
        uni.showToast({ title: error.message || '登录失败', icon: 'none' });
      }
    },
    passwordLogin(e) {
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

.code-row input {
  width: 35vw;
}

.code-button {
  min-width: 190rpx;
  margin-left: 12rpx;
  border: 0;
  border-radius: 10rpx;
  background: #e5efe3;
  color: #1f5c43;
  font-size: 24rpx;
  line-height: 80rpx;
}

.code-button::after,
.password-toggle::after {
  border: 0;
}

.demo-code {
  width: 65vw;
  margin: -8rpx auto 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 10rpx;
  background: #fff7d6;
  color: #715c11;
  box-sizing: border-box;
  font-size: 26rpx;
}

.demo-code text {
  font-weight: 800;
  letter-spacing: 4rpx;
}

.password-toggle {
  margin: 24rpx auto 0;
  background: transparent;
  color: #557065;
  font-size: 25rpx;
}

.password-form {
  margin-top: 18rpx;
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
  margin-top: 6vh;
}

.info > text[class*='cuIcon-'] {
  font-size: 40rpx;
  box-sizing: border-box;
}

</style>
