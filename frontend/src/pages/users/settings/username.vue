<template>
  <PageShell title="修改用户名">
    <view class="setting-hint">
      用户名是账号的唯一标识，也用于登录。
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
        placeholder="请输入不超过 20 位的用户名"
        :maxlength="20"
        required
        clearable
      />
      <BaseButton
        block
        text="保存"
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
import { changeUserInfo } from '@/services/user';
import { toLoginPage } from '@/routers/login';

const app = getApp();
export default {
  name: 'ChangeUsername',
  components: {
    BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      form: { username: '' },
      rules: {
        username: [
          { required: true, message: '请输入正确的用户名' },
          { whitespace: true, message: '请输入正确的用户名' },
        ],
      },
    };
  },
  computed: {
    currentUsername() {
      return app.globalData.userInfo.username;
    },
  },
  onShow() {
    if (!this.currentUsername) toLoginPage();
    this.form.username = this.currentUsername || '';
  },
  methods: {
    async saveUsername() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const userInfo = { ...app.globalData.userInfo, username: this.form.username };
      await changeUserInfo(app.globalData.id, userInfo);
      app.globalData.userInfo = userInfo;
      setTimeout(() => uni.navigateBack(), 1500);
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
