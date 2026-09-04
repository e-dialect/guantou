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
        登录后可以确认地区用法、补充词条、发表评论和录下乡音。
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
        <BaseField
          v-model="phone"
          class="phone-input"
          name="phone"
          label="手机号"
          type="number"
          :maxlength="13"
          placeholder="请输入手机号"
          required
          :error="errors.phone"
          @input="clearFieldError('phone')"
        />
        <view class="code-row">
          <view class="code-field">
            <BaseField
              v-model="code"
              class="code-input"
              name="code"
              label="验证码"
              type="number"
              :maxlength="6"
              placeholder="六位验证码"
              required
              :error="errors.code"
              @input="clearFieldError('code')"
            />
          </view>
          <BaseButton
            class="code-button"
            variant="ghost"
            size="medium"
            :disabled="countdown > 0 || sendingCode"
            @click="sendPhoneCode"
          >
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </BaseButton>
        </view>
        <view
          v-if="demoCode"
          class="demo-code"
        >
          Demo 验证码：<text>{{ demoCode }}</text>
        </view>
        <BaseButton
          class="phone-login-button"
          block
          :loading="submitting"
          @click="phoneLogin"
        >
          登录 / 注册
        </BaseButton>
      </view>

      <view
        v-else
        class="login-form password-form"
      >
        <BaseField
          v-model="username"
          name="username"
          label="账号"
          placeholder="请输入用户名"
          required
          :error="errors.username"
          @input="clearFieldError('username')"
        />
        <BaseField
          v-model="password"
          name="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          required
          :error="errors.password"
          @input="clearFieldError('password')"
        />
        <BaseButton
          block
          :loading="submitting"
          @click="passwordLogin"
        >
          账号密码登录
        </BaseButton>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <BaseButton
        class="wechat-login"
        block
        variant="ghost"
        @click="mpLogin()"
      >
        微信一键登录 / 注册
      </BaseButton>
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
import TTabPanel from '@tdesign/uniapp/tab-panel/tab-panel.vue';
import TTabs from '@tdesign/uniapp/tabs/tabs.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import { actionLabel, peekInterceptIntent } from '@/services/authGuard';
import { cancelLoginToSearch } from '@/services/authJourney';
import { mpLogin, normalLogin } from '@/services/login';
import { loginWithPhone, requestPhoneCode } from '@/services/phoneAuth';
import { toForgetPage, toRegisterPage, toWechatRegisterPage } from '@/routers/login';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';

export default {
  name: 'LoginPage',
  components: {
    PageShell,
    BaseButton,
    BaseField,
    TTabPanel,
    TTabs,
  },
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
      submitting: false,
      errors: {
        phone: '',
        code: '',
        username: '',
        password: '',
      },
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
      const value = event?.detail?.value ?? event?.value ?? event?.detail ?? event;
      const nextMode = value ?? 'phone';
      if (nextMode === this.loginMode) return;
      this.loginMode = nextMode;
      // 两种模式字段互斥，切走时清空错误，避免隐藏字段的旧错误阻塞提交。
      this.errors = {
        phone: '',
        code: '',
        username: '',
        password: '',
      };
    },
    clearFieldError(field) {
      this.errors[field] = '';
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
      const phone = String(this.phone || '').trim();
      this.errors.phone = phone ? '' : '请输入手机号';
      if (!phone) return;
      this.sendingCode = true;
      try {
        const response = await requestPhoneCode(phone);
        this.demoCode = response.demo_code || '';
        this.startCountdown(response.retry_after);
        uni.showToast({ title: '验证码已生成', icon: 'success' });
      } catch (error) {
        this.errors.phone = error.message || '验证码发送失败';
      } finally {
        this.sendingCode = false;
      }
    },
    async phoneLogin() {
      const phone = String(this.phone || '').trim();
      const code = String(this.code || '').trim();
      this.errors.phone = phone ? '' : '请输入手机号';
      this.errors.code = code ? '' : '请输入验证码';
      if (this.errors.phone || this.errors.code) return;
      this.submitting = true;
      try {
        await loginWithPhone(phone, code);
      } catch (error) {
        if (!applyFieldErrors(this.errors, error, ['phone', 'code'])) {
          uni.showToast({ title: readableErrorMessage(error) || '登录失败', icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
    async passwordLogin() {
      const username = String(this.username || '').trim();
      const { password } = this;
      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      if (this.errors.username || this.errors.password) return;
      this.submitting = true;
      try {
        await normalLogin(username, password);
      } finally {
        this.submitting = false;
      }
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
  border-radius: var(--radius-sm);
  background: var(--surface-color);
  box-shadow: 0 20rpx 60rpx var(--border-color);
  box-sizing: border-box;
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
  align-items: flex-end;
  gap: 12rpx;
}

.code-field {
  flex: 1;
  min-width: 0;
}

.code-button {
  flex: 0 0 auto;
  margin-bottom: var(--space-3);
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
  transition: opacity 0.2s ease;
}

.browse-first:active {
  opacity: 0.6;
}

.login-links {
  display: flex;
  justify-content: center;
  gap: 44rpx;
  margin-top: 22rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.login-links text {
  transition: color 0.2s ease;
}

.login-links text:active {
  color: var(--accent-color);
}

@media (prefers-reduced-motion: reduce) {
  .browse-first,
  .login-links text {
    transition: none;
  }
}

:deep(.login-content) {
  background: linear-gradient(
    180deg,
    var(--page-color) 0%,
    var(--surface-subtle-color) 100%
  );
}
</style>
