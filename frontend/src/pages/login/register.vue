<template>
  <PageShell
    title="用户注册"
    :show-back="true"
  >
    <view class="auth-card">
      <view class="auth-card__title">
        创建账号
      </view>
      <view class="auth-card__lead">
        注册后可以收藏乡音、确认地区用法、补充词条并参与讨论。
      </view>

      <view class="auth-form">
        <BaseField
          v-model="username"
          name="username"
          label="用户名"
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
          placeholder="请输入6~32位密码"
          required
          :error="errors.password"
          @input="clearFieldError('password')"
        />
        <BaseField
          v-model="passwordConfirmed"
          name="passwordConfirmed"
          label="确认密码"
          type="password"
          placeholder="请再次输入密码"
          required
          :error="errors.passwordConfirmed"
          @input="clearFieldError('passwordConfirmed')"
        />
        <BaseField
          v-model="email"
          name="email"
          label="邮箱"
          placeholder="请输入邮箱"
          required
          :error="errors.email"
          @input="clearFieldError('email')"
        />

        <view class="code-row">
          <view class="code-field">
            <BaseField
              v-model="code"
              name="code"
              label="验证码"
              placeholder="请输入验证码"
              required
              :error="errors.code"
              @input="clearFieldError('code')"
            />
          </view>
          <BaseButton
            class="code-button"
            variant="ghost"
            size="medium"
            :disabled="isSending"
            @click="getCode"
          >
            {{ sendCodeMsg }}
          </BaseButton>
        </view>
        <BaseButton
          block
          :loading="submitting"
          @click="register"
        >
          注册
        </BaseButton>
      </view>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import { normalLogin } from '@/services/login';
import { registerUser } from '@/services/user';
import { sendEmailCode } from '@/services/verification';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SEND_COUNTDOWN = 30;

export default {
  name: 'RegisterPage',
  components: { PageShell, BaseButton, BaseField },
  data() {
    return {
      username: '',
      password: '',
      passwordConfirmed: '',
      email: '',
      code: '',
      submitting: false,
      isSending: false,
      count: SEND_COUNTDOWN,
      errors: {
        username: '',
        password: '',
        passwordConfirmed: '',
        email: '',
        code: '',
      },
    };
  },
  computed: {
    sendCodeMsg() {
      return !this.isSending ? '获取验证码' : `重新获取(${this.count})`;
    },
  },
  watch: {
    isSending(value) {
      if (value) {
        const timer = setInterval(() => {
          this.count -= 1;
          if (this.count <= 0) {
            this.isSending = false;
            this.count = SEND_COUNTDOWN;
            clearInterval(timer);
          }
        }, 1000);
      }
    },
  },
  methods: {
    clearFieldError(field) {
      this.errors[field] = '';
    },
    async getCode() {
      const email = String(this.email || '').trim();
      if (!email) {
        this.errors.email = '请输入邮箱';
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        this.errors.email = '请填写正确的邮箱';
        return;
      }
      this.errors.email = '';
      try {
        await sendEmailCode(email, 'register');
        uni.showToast({ title: '验证码已发送', icon: 'success' });
        this.isSending = true;
      } catch (error) {
        if (!applyFieldErrors(this.errors, error, ['email'])) {
          uni.showToast({
            title: readableErrorMessage(error) || '验证码发送失败',
            icon: 'none',
          });
        }
      }
    },
    async register() {
      const username = String(this.username || '').trim();
      const { password, passwordConfirmed } = this;
      const email = String(this.email || '').trim();
      const code = String(this.code || '').trim();

      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      this.errors.passwordConfirmed = passwordConfirmed ? '' : '请再次输入密码';
      this.errors.email = email ? '' : '请输入邮箱';
      this.errors.code = code ? '' : '请输入验证码';
      if (this.errors.username || this.errors.password || this.errors.passwordConfirmed
        || this.errors.email || this.errors.code) return;

      if (password.length < 6 || password.length > 32) {
        this.errors.password = '密码长度 6 - 32 位';
        return;
      }
      if (password !== passwordConfirmed) {
        this.errors.passwordConfirmed = '两次密码不相同';
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        this.errors.email = '请填写正确的邮箱';
        return;
      }

      this.submitting = true;
      try {
        await registerUser(username, password, email, code);
        await normalLogin(username, password, { isNew: true });
      } catch (error) {
        const mapped = applyFieldErrors(
          this.errors,
          error,
          ['username', 'password', 'email', 'code'],
        );
        if (!mapped) {
          const title = readableErrorMessage(error, {
            400: '注册信息无效',
            401: '验证码错误',
            409: '用户名或邮箱已存在',
          }) || '注册失败';
          uni.showToast({ title, icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.auth-card {
  max-width: 680rpx;
  margin: 42rpx auto 0;
  padding: 52rpx 34rpx 38rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-shadow: 0 20rpx 60rpx var(--border-color);
  box-sizing: border-box;
}

.auth-card__title {
  color: var(--text-color);
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.auth-card__lead {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.auth-form {
  margin-top: var(--space-4);
}

.code-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.code-field {
  flex: 1;
  min-width: 0;
}

.code-button {
  flex: 0 0 auto;
  margin-bottom: var(--space-3);
}

</style>
