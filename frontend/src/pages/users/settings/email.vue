<template>
  <view>
    <cu-custom title="修改邮箱" />
    <view class="cu-form-group">
      <view class="text-df text-bold-less margin-right-sm">
        原邮箱
      </view>
      <input
        :value="old_email"
        :disabled="true"
      >
    </view>
    <view class="cu-form-group">
      <view class="text-df text-bold-less margin-right-sm">
        新邮箱
      </view>
      <input
        placeholder="请输入新邮箱"
        @input="getNewEmail"
      >
    </view>
    <view class="cu-form-group">
      <view class="text-df text-bold-less margin-right-sm">
        验证码
      </view>
      <input
        placeholder="请输入验证码"
        @input="getCode"
      >
      <button
        class="cu-btn bg-gradual-blue shadow"
        style="width: 32vw; border-radius: 5000rpx"
        @tap="sendCode"
      >
        获取验证码
      </button>
    </view>
    <button
      class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
      style="display: flex; justify-content: center"
      @tap="setNewEmail"
    >
      保存
    </button>
  </view>
</template>

<script>
import { changeUserEmail, getUserInfo } from '@/services/user';
import { sendEmailCode } from '@/services/verification';

const app = getApp();
export default {
  data() {
    return {
      old_email: '',
      code: '',
      new_email: '',
    };
  },
  onLoad() {
    this.getUserEmail();
  },
  methods: {
    /**
     * 获取用户未更改前的邮箱信息
     * @returns {Promise<void>}
     */
    async getUserEmail() {
      const userInfo = await getUserInfo(app.globalData.id);
      this.old_email = userInfo.user.email;
    },

    getCode(e) {
      this.code = e.detail.value;
    },

    getNewEmail(e) {
      this.new_email = e.detail.value;
    },

    /**
     * 发送邮箱验证码
     */
    sendCode() {
      const email = this.new_email;
      sendEmailCode(email);
    },

    /**
     * 发送新邮箱
     */
    setNewEmail() {
      const { code } = this;
      const email = this.new_email;
      changeUserEmail(app.globalData.id, email, code).then(async () => {
        setTimeout(() => {
          uni.showToast({
            title: '修改成功',
          });
        }, 100);
        uni.navigateBack({
          delta: 1,
        }); // 返回上一个页面
      });
    },
  },
};
</script>
<style>
</style>
