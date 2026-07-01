<template>
  <view>
    <cu-custom title="忘记密码" />
    <block v-if="steps === 0">
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          用户名
        </view>
        <input
          name="username"
          placeholder="请输入用户名"
          @input="getUsername"
        >
      </view>
      <button
        class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
        style="width: 20vw; margin-left: 75vw"
        @tap="next"
      >
        下一步
      </button>
    </block>
    <form
      v-if="steps === 1"
      @submit="reset"
    >
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          密码
        </view>
        <input
          name="password"
          :password="hidePassword"
          placeholder="请输入新密码"
        >
        <text
          :class="hidePassword === true ? 'cuIcon-attention' : 'cuIcon-attentionforbid'"
          @tap="hidePassword=!hidePassword"
        />
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          重复密码
        </view>
        <input
          name="repeatedPassword"
          :password="hidePassword"
          placeholder="请重复新密码"
        >
        <text
          :class="hideRepeatedPassword === true ? 'cuIcon-attention' : 'cuIcon-attentionforbid'"
          @tap="hideRepeatedPassword=!hideRepeatedPassword"
        />
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          邮箱
        </view>
        <input
          name="email"
          :value="email"
          disabled
        >
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          验证码
        </view>
        <input
          name="code"
          placeholder="请输入验证码"
        >
        <button
          class="cu-btn bg-gradual-blue shadow"
          style="width: 32vw; border-radius: 5000rpx"
          :disabled="isSending"
          @tap="getCode"
        >
          {{ sendCodeMsg }}
        </button>
      </view>
      <button
        class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
        style="display: flex; justify-content: center"
        form-type="submit"
      >
        重置密码
      </button>
    </form>
  </view>
</template>

<script>
import { getEmailByUsername, resetPassword } from '@/services/user';
import CuCustom from '@/colorui/components/cu-custom.vue';
import getCodeMixin from './mixin/getCodeMixin';

export default {
  components: { CuCustom },
  mixins: [getCodeMixin],
  data() {
    return {
      username: '',
      email: '',
      steps: 0,
      hidePassword: true,
      hideRepeatedPassword: true,
    };
  },
  methods: {
    getUsername(e) {
      this.username = e.detail.value;
    },

    next() {
      getEmailByUsername(this.username).then((res) => {
        this.email = res.email;
        this.steps = 1;
      });
    },

    // 获取验证码
    getCode() {
      this.sendEmCode(this.email);
    },

    reset(e) {
      const { username } = this;
      const { email } = this;
      const { code, password, repeatedPassword } = e.detail.value;
      if (repeatedPassword !== password) {
        uni.showToast({
          title: '两次密码不一致',
          icon: 'none',
        });
        return;
      }
      resetPassword(username, email, code, password).then(() => {
        uni.showToast({
          title: '重置成功',
          icon: 'success',
          duration: 2000,
        });
        uni.navigateBack({
          delta: 1,
        });
      });
    },
  },
};
</script>
