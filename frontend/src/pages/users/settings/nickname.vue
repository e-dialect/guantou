<template>
  <PageShell
    title="修改昵称"
    :back-fallback="ROUTES.userInformation"
  >
    <AccountSettingPanel
      eyebrow="公开身份"
      mark="名"
      title="大家怎么称呼你"
      description="昵称会展示给其他乡友，可以比登录用户名更亲切。"
    >
      <view
        v-if="canUseWechatAuth"
        class="setting-note"
      >
        也可以点下方授权，填入微信昵称后再确认保存。
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
          required
          clearable
          placeholder="请输入不超过 20 位的昵称"
          :maxlength="20"
          :error="error"
          :disabled="saving"
        />
        <!-- 微信昵称只能写在原生 input[type=nickname] 上，H5 编译时会去掉。 -->
        <!--  #ifdef  MP-WEIXIN -->
        <input
          v-if="canUseWechatAuth"
          class="wechat-nickname"
          type="nickname"
          :value="form.nickname"
          placeholder="点这里填入微信昵称"
          :disabled="saving"
          @blur="onWechatNickname"
        >
        <!--  #endif -->
        <BaseButton
          block
          text="保存昵称"
          :disabled="saving || form.nickname === currentNickname"
          :loading="saving"
          @click="saveNickname"
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
import { CAPABILITIES, isCapabilityEnabled } from '@/services/capabilities';
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
  name: 'ChangeNickname',
  components: {
    AccountSettingPanel, BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      ROUTES,
      form: { nickname: '' },
      rules: {
        nickname: [
          { required: true, message: '请输入正确的昵称' },
          { whitespace: true, message: '请输入正确的昵称' },
        ],
      },
      error: '',
      saving: false,
      canUseWechatAuth: isCapabilityEnabled(CAPABILITIES.WECHAT_AUTH),
    };
  },
  computed: {
    currentNickname() {
      return app.globalData.userInfo?.nickname || '';
    },
  },
  onShow() {
    this.canUseWechatAuth = isCapabilityEnabled(CAPABILITIES.WECHAT_AUTH);
    if (!resolveSessionUserId()) {
      goLogin({}, { reset: true });
      return;
    }
    this.form.nickname = this.currentNickname;
    this.error = '';
  },
  methods: {
    onWechatNickname(event) {
      const nickname = String(event?.detail?.value || '').trim().slice(0, 20);
      if (!nickname) return;
      this.form.nickname = nickname;
      this.error = '';
      notifySuccess('已填入微信昵称，确认后点保存');
    },
    async saveNickname() {
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;
      const nickname = String(this.form.nickname || '').trim();
      if (!nickname) {
        this.error = '请输入昵称';
        return;
      }
      this.error = '';
      this.saving = true;
      try {
        const userInfo = { ...app.globalData.userInfo, nickname };
        await changeUserInfo(resolveSessionUserId(), userInfo);
        app.globalData.userInfo = userInfo;
        notifySuccess('修改成功');
        goBack(ROUTES.userInformation);
      } catch (error) {
        this.error = fieldErrorMessage(error, 'nickname') || error?.message || '保存失败，请检查网络后重试';
        notify({ title: this.error });
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.setting-note {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.wechat-nickname {
  width: 100%;
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-base);
  line-height: 1.6;
  text-align: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-sizing: border-box;
}
</style>
