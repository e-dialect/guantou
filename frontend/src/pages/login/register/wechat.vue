<template>
  <PageShell
    title="微信注册"
    :show-back="true"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="微信身份接入"
      title="为微信登录留个署名"
      lead="补全用户名、昵称和密码后，这个微信账号就能安全进入你的乡声档案。"
      :step="1"
      :step-total="2"
      step-label="补全账户"
    >
      <view class="auth-form">
        <BaseField
          v-model="username"
          name="username"
          label="用户名"
          placeholder="请输入用户名（账号唯一标识）"
          required
          :error="errors.username"
          @input="clearFieldError('username')"
        />
        <BaseField
          v-model="nickname"
          name="nickname"
          label="昵称"
          placeholder="请输入昵称（空白则默认为用户名）"
          :error="errors.nickname"
          @input="clearFieldError('nickname')"
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

        <BaseButton
          block
          :loading="submitting"
          @click="wechatRegister"
        >
          创建账户并继续
        </BaseButton>
      </view>
    </AuthJourney>
  </PageShell>
</template>

<script>
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import confirmDialog from '@/components/ConfirmDialog';
import { registerWechatUser } from '@/services/user';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';

export default {
  name: 'WechatRegisterPage',
  components: {
    AuthJourney, PageShell, BaseButton, BaseField,
  },
  data() {
    return {
      username: '',
      nickname: '',
      password: '',
      passwordConfirmed: '',
      submitting: false,
      errors: {
        username: '',
        nickname: '',
        password: '',
        passwordConfirmed: '',
      },
    };
  },
  methods: {
    clearFieldError(field) {
      this.errors[field] = '';
    },
    async wechatRegister() {
      const username = String(this.username || '').trim();
      const nickname = String(this.nickname || '').trim();
      const { password, passwordConfirmed } = this;

      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      this.errors.passwordConfirmed = passwordConfirmed ? '' : '请再次输入密码';
      if (this.errors.username || this.errors.password || this.errors.passwordConfirmed) return;

      if (password.length < 6 || password.length > 32) {
        this.errors.password = '密码长度 6 - 32 位';
        return;
      }
      if (password !== passwordConfirmed) {
        this.errors.passwordConfirmed = '两次密码不相同';
        return;
      }

      let finalNickname = nickname;
      if (!finalNickname) {
        const confirmed = await confirmDialog({
          content: '未填写昵称将会用用户名暂代哦~',
        });
        if (!confirmed) return;
        finalNickname = username;
      }

      this.submitting = true;
      try {
        await registerWechatUser(username, password, finalNickname);
      } catch (error) {
        if (!applyFieldErrors(this.errors, error, ['username', 'nickname', 'password'])) {
          uni.showToast({ title: readableErrorMessage(error) || '注册失败', icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
:deep(.auth-page) {
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 36%,
    var(--surface-subtle-color) 100%
  );
}
</style>
