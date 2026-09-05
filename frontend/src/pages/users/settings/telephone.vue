<template>
  <PageShell
    title="修改手机"
    :back-fallback="ROUTES.userInformation"
  >
    <AccountSettingPanel
      eyebrow="账户与安全"
      mark="机"
      title="更新登录手机号"
      description="请填写 11 位大陆手机号，用于验证码登录和身份确认。"
    >
      <BaseForm
        ref="form"
        :data="form"
        :rules="rules"
      >
        <BaseField
          v-model="form.telephone"
          name="telephone"
          type="tel"
          label="手机号"
          required
          clearable
          placeholder="请输入 11 位手机号"
          :maxlength="11"
          :error="error"
          :disabled="saving"
        />
        <BaseButton
          block
          text="保存手机号"
          :disabled="saving || form.telephone === currentTelephone"
          :loading="saving"
          @click="savePhone"
        />
      </BaseForm>
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
import { changeUserInfo, getUserInfo } from '@/services/user';

const app = getApp();

function fieldErrorMessage(error, field) {
  const item = error?.data?.[field] || error?.data?.user?.[field];
  if (typeof item === 'string') return item;
  if (item?.message) return item.message;
  return '';
}

export default {
  name: 'ChangeTelephone',
  components: {
    AccountSettingPanel, BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      ROUTES,
      form: { telephone: app.globalData.userInfo?.telephone || '' },
      rules: {
        telephone: [{
          validator: (value) => /^\d{11}$/.test(String(value || '')),
          message: '请输入正确格式的手机号码',
        }],
      },
      error: '',
      saving: false,
    };
  },
  computed: {
    currentTelephone() {
      return app.globalData.userInfo?.telephone || '';
    },
  },
  onShow() {
    if (!resolveSessionUserId()) {
      goLogin({}, { reset: true });
      return;
    }
    this.form.telephone = this.currentTelephone;
    this.error = '';
  },
  methods: {
    async savePhone() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const telephone = String(this.form.telephone || '').trim();
      if (!/^\d{11}$/.test(telephone)) {
        this.error = '请输入正确格式的手机号码';
        return;
      }
      this.error = '';
      this.saving = true;
      try {
        const userInfo = await getUserInfo(resolveSessionUserId(), true);
        userInfo.user.telephone = telephone;
        await changeUserInfo(resolveSessionUserId(), userInfo.user);
        app.globalData.userInfo.telephone = telephone;
        notifySuccess('修改成功');
        goBack(ROUTES.userInformation);
      } catch (error) {
        this.error = fieldErrorMessage(error, 'telephone') || error?.message || '保存失败，请检查网络后重试';
        notify({ title: this.error });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
