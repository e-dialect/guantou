<template>
  <PageShell
    title="登录"
    :scroll="false"
    content-class="login-content"
  >
    <view class="login-card">
      <view class="login-card__stamp">
        身份校验处
      </view>
      <view class="login-card__title">
        回来听一听乡音
      </view>
      <view class="login-card__lead">
        登录后可以支持铭牌、发表评论和提出自己的立论。
      </view>

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

      <t-tabs
        :value="loginMode"
        class="login-tabs"
        @change="changeMode"
      >
        <t-tab-panel
          value="phone"
          label="手机验证码"
        />
        <t-tab-panel
          value="password"
          label="账号密码"
        />
      </t-tabs>

      <view
        v-if="loginMode === 'phone'"
        class="login-form phone-form"
      >
        <t-input
          v-model="phone"
          class="phone-input"
          label="手机号"
          type="number"
          maxlength="13"
          placeholder="请输入手机号"
          clearable
        />
        <view class="code-row">
          <t-input
            v-model="code"
            class="code-input"
            label="验证码"
            type="number"
            maxlength="6"
            placeholder="六位验证码"
          />
          <t-button
            class="code-button"
            theme="light"
            size="small"
            :disabled="countdown > 0 || sendingCode"
            @tap="sendPhoneCode"
          >
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </t-button>
        </view>
        <view
          v-if="demoCode"
          class="demo-code"
        >
          Demo 验证码：<text>{{ demoCode }}</text>
        </view>
        <t-button
          block
          theme="primary"
          size="large"
          @tap="phoneLogin"
        >
          登录 / 注册
        </t-button>
      </view>

      <view
        v-else
        class="login-form password-form"
      >
        <t-input
          v-model="username"
          label="账号"
          placeholder="请输入用户名"
          clearable
        />
        <t-input
          v-model="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
        />
        <t-button
          block
          theme="primary"
          size="large"
          @tap="passwordLogin"
        >
          账号密码登录
        </t-button>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <t-button
        class="wechat-login"
        block
        theme="light"
        @tap="mpLogin()"
      >
        微信一键登录 / 注册
      </t-button>
      <!-- #endif -->

      <view class="login-card__secondary">
        <view
          class="browse-first"
          @tap="cancelLoginToSearch"
        >
          暂不登录，先去查词
        </view>
        <view class="login-links">
          <text @tap="toForgetPage()">
            忘记密码
          </text>
          <!-- #ifndef MP-WEIXIN -->
          <text @tap="toRegisterPage()">
            用户注册
          </text>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
          <text @tap="toWechatRegisterPage()">
            微信注册
          </text>
          <!-- #endif -->
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import { actionLabel, peekInterceptIntent } from '@/services/authGuard';
import { cancelLoginToSearch } from '@/services/authJourney';
import { mpLogin, normalLogin } from '@/services/login';
import { loginWithPhone, requestPhoneCode } from '@/services/phoneAuth';
import { toForgetPage, toRegisterPage, toWechatRegisterPage } from '@/routers/login';

export default {
  components: { PageShell },
  data() {
    return {
      toForgetPage,
      toRegisterPage,
      toWechatRegisterPage,
      intent: null,
      loginMode: 'phone',
      phone: '',
      code: '',
      username: '',
      password: '',
      demoCode: '',
      countdown: 0,
      countdownTimer: null,
      sendingCode: false,
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
    changeMode(event) {
      this.loginMode = event?.detail?.value || event?.detail || event || 'phone';
    },
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
    passwordLogin() {
      normalLogin(this.username, this.password);
    },
  },
};
</script>

<style scoped>
.login-card {
  position: relative;
  max-width: 680rpx;
  margin: 42rpx auto 0;
  padding: 52rpx 34rpx 38rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  background: var(--surface-color);
  box-shadow: 0 20rpx 60rpx var(--border-color);
}

.login-card__stamp {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  padding: 8rpx 12rpx;
  border: 2rpx solid var(--danger-color);
  color: var(--danger-color);
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
  transform: rotate(3deg);
}

.login-card__title {
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: 44rpx;
  font-weight: 900;
}

.login-card__lead {
  width: 76%;
  margin-top: 14rpx;
  color: var(--text-secondary-color);
  font-size: 24rpx;
  line-height: 1.6;
}

.intent-banner {
  margin-top: 28rpx;
  padding: 20rpx 22rpx;
  border-left: 7rpx solid var(--accent-color);
  background: var(--accent-subtle-color);
}

.intent-kicker {
  color: var(--accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.intent-copy {
  margin-top: 6rpx;
  color: var(--text-secondary-color);
  font-size: 24rpx;
  line-height: 1.5;
}

.login-tabs {
  display: block;
  margin-top: 34rpx;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 28rpx;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.code-input {
  flex: 1;
}

.code-button {
  flex: 0 0 auto;
}

.demo-code {
  padding: 14rpx 18rpx;
  background: var(--surface-subtle-color);
  color: var(--warning-color);
  font-size: 23rpx;
}

.demo-code text {
  font-weight: 900;
  letter-spacing: 4rpx;
}

.wechat-login {
  display: block;
  margin-top: 18rpx;
}

.login-card__secondary {
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: 1rpx dashed var(--border-color);
}

.browse-first {
  color: var(--accent-color);
  text-align: center;
  font-size: 24rpx;
}

.login-links {
  display: flex;
  justify-content: center;
  gap: 44rpx;
  margin-top: 22rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

:deep(.login-content) {
  background: linear-gradient(
    180deg,
    var(--page-color) 0%,
    var(--surface-subtle-color) 100%
  );
}
</style>
