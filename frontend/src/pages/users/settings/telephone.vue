<template>
  <PageShell title="修改手机">
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
        placeholder="请输入 11 位手机号"
        :maxlength="11"
        required
        clearable
      />
      <BaseButton
        block
        text="保存"
        :disabled="form.telephone === currentTelephone"
        @click="savePhone"
      />
    </BaseForm>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import PageShell from '@/components/PageShell.vue';
import { changeUserInfo, getUserInfo } from '@/services/user';

const app = getApp();
export default {
  name: 'ChangeTelephone',
  components: {
    BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      form: { telephone: app.globalData.userInfo.telephone || '' },
      rules: {
        telephone: [{
          validator: (value) => /^\d{11}$/.test(String(value || '')),
          message: '请输入正确格式的手机号码',
        }],
      },
    };
  },
  computed: {
    currentTelephone() {
      return app.globalData.userInfo.telephone || '';
    },
  },
  methods: {
    async savePhone() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const userInfo = await getUserInfo(app.globalData.id);
      userInfo.user.telephone = this.form.telephone;
      await changeUserInfo(app.globalData.id, userInfo.user);
      app.globalData.userInfo.telephone = this.form.telephone;
      setTimeout(() => uni.navigateBack(), 1000);
    },
  },
};
</script>
