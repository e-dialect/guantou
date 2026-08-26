<template>
  <PageShell title="修改昵称">
    <view class="setting-hint">
      昵称用于站内交流和公开展示。
    </view>
    <BaseForm
      ref="form"
      :data="form"
      :rules="rules"
    >
      <BaseField
        v-model="form.nickname"
        name="nickname"
        label="昵称"
        placeholder="请输入不超过 20 位的昵称"
        :maxlength="20"
        required
        clearable
      />
      <BaseButton
        block
        text="保存"
        :disabled="form.nickname === currentNickname"
        @click="saveNickname"
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
  name: 'ChangeNickname',
  components: {
    BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      form: { nickname: '' },
      rules: {
        nickname: [
          { required: true, message: '请输入正确的昵称' },
          { whitespace: true, message: '请输入正确的昵称' },
        ],
      },
    };
  },
  computed: {
    currentNickname() {
      return app.globalData.userInfo.nickname;
    },
  },
  onShow() {
    if (!this.currentNickname) toLoginPage();
    this.form.nickname = this.currentNickname || '';
  },
  methods: {
    async saveNickname() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const userInfo = { ...app.globalData.userInfo, nickname: this.form.nickname };
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
