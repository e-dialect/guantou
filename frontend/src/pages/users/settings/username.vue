<template>
  <PageShell
    title="修改用户名"
    :back-fallback="ROUTES.userInformation"
  >
    <view class="setting-hint">
      用户名是识别账号的标识，也用于账号密码登录。
    </view>
    <BaseForm
      ref="form"
      :data="form"
      :rules="rules"
    >
      <BaseField
        v-model="form.username"
        name="username"
        label="用户名"
        required
        clearable
        placeholder="请输入不超过 20 位的用户名"
        :maxlength="20"
        :error="error"
        :disabled="saving"
      />
      <BaseButton
        block
        text="保存"
        :disabled="saving || form.username === currentUsername"
        :loading="saving"
        @click="saveUsername"
      />
    </BaseForm>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import PageShell from '@/components/PageShell.vue';
import { notify, notifySuccess } from '@/services/feedback';
import { goBack, goLogin, ROUTES } from '@/services/navigation';
import { resolveSessionUserId } from '@/services/session';
import { changeUserInfo } from '@/services/user';

const app = getApp();

function fieldErrorMessage(error, field) {
  const item = error?.data?.[field] || error?.data?.user?.[field];
  if (typeof item === 'string') return item;
  if (item?.message) return item.message;
  return '';
}

export default {
  name: 'ChangeUsername',
  components: {
    BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      ROUTES,
      form: { username: '' },
      rules: {
        username: [
          { required: true, message: '请输入正确的用户名' },
          { whitespace: true, message: '请输入正确的用户名' },
        ],
      },
      error: '',
      saving: false,
    };
  },
  computed: {
    currentUsername() {
      return app.globalData.userInfo?.username || '';
    },
  },
  onShow() {
    if (!resolveSessionUserId()) {
      goLogin({}, { reset: true });
      return;
    }
    this.form.username = this.currentUsername;
    this.error = '';
  },
  methods: {
    async saveUsername() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const username = String(this.form.username || '').trim();
      if (!username) {
        this.error = '请输入用户名';
        return;
      }
      this.error = '';
      this.saving = true;
      try {
        const userInfo = { ...app.globalData.userInfo, username };
        await changeUserInfo(app.globalData.id, userInfo);
        app.globalData.userInfo = userInfo;
        notifySuccess('修改成功');
        goBack(ROUTES.userInformation);
      } catch (error) {
        this.error = fieldErrorMessage(error, 'username') || error?.message || '保存失败，请检查网络后重试';
        notify({ title: this.error });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.setting-hint {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
</style>
