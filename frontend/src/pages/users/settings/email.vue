<template>
  <PageShell
    title="修改邮箱"
    :back-fallback="ROUTES.userInformation"
  >
    <AccountSettingPanel
      eyebrow="账户与安全"
      mark="邮"
      title="更新联系邮箱"
      description="验证码会发往新的地址，验证通过后才会替换当前绑定。"
    >
      <view
        v-if="loading"
        class="state-card"
      >
        正在读取邮箱…
      </view>
      <view
        v-else-if="loadError"
        class="state-card"
      >
        <view>{{ loadError }}</view>
        <BaseButton
          class="state-action"
          block
          @click="getUserEmail"
        >
          重试
        </BaseButton>
      </view>
      <view
        v-else
        class="email-form"
      >
        <view class="account-summary">
          当前绑定 · {{ oldEmailDisplay }}
        </view>
        <BaseForm
          ref="form"
          :data="formData"
          :rules="rules"
        >
          <BaseField
            :model-value="oldEmailDisplay"
            name="oldEmail"
            label="原邮箱"
            disabled
          />
          <BaseField
            v-model="newEmail"
            name="email"
            label="新邮箱"
            required
            placeholder="请输入新邮箱"
            :error="emailError"
            :disabled="saving"
          />
          <view class="code-row">
            <view class="code-field">
              <BaseField
                v-model="code"
                name="code"
                label="验证码"
                required
                placeholder="请输入验证码"
                :maxlength="6"
                :error="codeError"
                :disabled="saving"
              />
            </view>
            <BaseButton
              class="code-button"
              size="small"
              variant="ghost"
              :disabled="sending || saving || countdown > 0"
              :loading="sending"
              @click="sendCode"
            >
              {{ sendCodeLabel }}
            </BaseButton>
          </view>
          <view
            v-if="demoCode"
            class="demo-code"
          >
            Demo 验证码：<text>{{ demoCode }}</text>
          </view>
          <BaseButton
            block
            :disabled="saving || sending"
            :loading="saving"
            @click="setNewEmail"
          >
            保存新邮箱
          </BaseButton>
        </BaseForm>
      </view>
    </AccountSettingPanel>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import PageShell from '@/components/PageShell.vue';
import AccountSettingPanel from '@/pages/users/settings/components/AccountSettingPanel.vue';
import { notify, notifySuccess } from '@/services/feedback';
import { goBack, goLogin, ROUTES } from '@/services/navigation';
import { resolveSessionUserId } from '@/services/session';
import { changeUserEmail, getUserInfo } from '@/services/user';
import { sendEmailCode } from '@/services/verification';

const CODE_THROTTLE_SECONDS = 60;

function fieldErrorMessage(error, field) {
  const item = error?.data?.[field] || error?.data?.user?.[field];
  if (typeof item === 'string') return item;
  if (item?.message) return item.message;
  return '';
}

function applyEmailErrors(error) {
  const emailError = fieldErrorMessage(error, 'email');
  const codeError = fieldErrorMessage(error, 'code');
  if (emailError || codeError) {
    return { emailError, codeError };
  }
  const message = error?.message || '保存失败，请检查网络后重试';
  if (error?.statusCode === 409) {
    return { emailError: message, codeError: '' };
  }
  return { emailError: '', codeError: message };
}

export default {
  name: 'ChangeEmail',
  components: {
    AccountSettingPanel, BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      ROUTES,
      oldEmail: '',
      newEmail: '',
      code: '',
      emailError: '',
      codeError: '',
      sending: false,
      saving: false,
      loading: true,
      loadError: '',
      ready: false,
      countdown: 0,
      countdownTimer: null,
      demoCode: '',
      rules: {
        email: [{ required: true, message: '请输入新邮箱' }],
        code: [{ required: true, message: '请输入验证码' }],
      },
    };
  },
  computed: {
    oldEmailDisplay() {
      return this.oldEmail || '尚未绑定邮箱';
    },
    sendCodeLabel() {
      if (this.countdown > 0) return `${this.countdown}s 后重发`;
      return '获取验证码';
    },
    formData() {
      return { email: this.newEmail, code: this.code };
    },
  },
  onShow() {
    if (!resolveSessionUserId()) {
      goLogin({}, { reset: true });
      return;
    }
    if (!this.ready) this.getUserEmail();
  },
  onUnload() {
    this.clearCountdown();
  },
  methods: {
    clearCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.countdown = 0;
    },
    startCountdown(seconds) {
      this.clearCountdown();
      this.countdown = Number(seconds) || CODE_THROTTLE_SECONDS;
      this.countdownTimer = setInterval(() => {
        this.countdown -= 1;
        if (this.countdown <= 0) this.clearCountdown();
      }, 1000);
    },
    async getUserEmail() {
      this.loading = true;
      this.loadError = '';
      try {
        const userInfo = await getUserInfo(resolveSessionUserId(), true);
        this.oldEmail = userInfo.user.email || '';
      } catch (error) {
        this.loadError = error?.message || '邮箱读取失败，请检查网络后重试';
      } finally {
        this.loading = false;
        this.ready = true;
      }
    },
    async sendCode() {
      if (this.sending || this.saving || this.countdown > 0) return;
      const email = String(this.newEmail || '').trim();
      if (!email) {
        this.emailError = '请输入新邮箱';
        return;
      }
      if (this.oldEmail && email.toLowerCase() === this.oldEmail.toLowerCase()) {
        this.emailError = '请填写与当前邮箱不同的地址';
        return;
      }
      this.emailError = '';
      this.sending = true;
      try {
        const response = await sendEmailCode(email, 'bind', true);
        this.demoCode = response?.demo_code || '';
        notify({ title: this.demoCode ? '验证码已生成' : '验证码已发送' });
        this.startCountdown(response?.retry_after);
      } catch (error) {
        this.emailError = fieldErrorMessage(error, 'email')
          || error?.message
          || '验证码发送失败';
        notify({ title: this.emailError });
        if (error?.statusCode === 429) {
          this.startCountdown(error?.data?.retry_after || CODE_THROTTLE_SECONDS);
        }
      } finally {
        this.sending = false;
      }
    },
    async setNewEmail() {
      if (this.saving || this.sending) return;
      const email = String(this.newEmail || '').trim();
      const code = String(this.code || '').trim();
      this.emailError = email ? '' : '请输入新邮箱';
      this.codeError = code ? '' : '请输入验证码';
      if (!email || !code) return;
      if (this.oldEmail && email.toLowerCase() === this.oldEmail.toLowerCase()) {
        this.emailError = '请填写与当前邮箱不同的地址';
        return;
      }
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      this.saving = true;
      try {
        await changeUserEmail(resolveSessionUserId(), email, code);
        notifySuccess('修改成功');
        goBack(ROUTES.userInformation);
      } catch (error) {
        const next = applyEmailErrors(error);
        this.emailError = next.emailError;
        this.codeError = next.codeError;
        notify({ title: this.emailError || this.codeError || '保存失败，请检查网络后重试' });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.state-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-secondary-color);
}

.state-action {
  margin-top: var(--space-3);
}

.email-form {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.account-summary {
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.code-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.code-field {
  min-width: 0;
  flex: 1;
}

.code-button {
  margin-bottom: var(--space-3);
  flex-shrink: 0;
}

.demo-code {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-subtle-color);
  color: var(--warning-color);
  font-size: var(--font-size-sm);
}

.demo-code text {
  font-weight: 700;
  letter-spacing: 0.2em;
}

:deep(.base-field-control),
:deep(.uni-input-wrapper),
:deep(.uni-input-input) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
</style>
