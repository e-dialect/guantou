<template>
  <view>
    <cu-custom title="用户注册" />
    <form @submit="register">
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          用户名
        </view>
        <input
          name="username"
          placeholder="请输入用户名"
        >
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          密码
        </view>
        <input
          name="password"
          :password="is_pwd1"
          placeholder="请输入6~32位密码"
        >
        <text
          :class="is_pwd1 === true ? 'cuIcon-attention' : 'cuIcon-attentionforbid'"
          @tap="ear1"
        />
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          确认密码
        </view>
        <input
          name="passwordConfirmed"
          :password="is_pwd2"
          placeholder="请再次输入密码"
        >
        <text
          :class="is_pwd2 === true ? 'cuIcon-attention' : 'cuIcon-attentionforbid'"
          @tap="ear2"
        />
      </view>
      <view class="cu-form-group">
        <view class="text-df text-bold-less margin-right-sm">
          邮箱
        </view>
        <input
          name="email"
          placeholder="请输入邮箱"
          inputmode="email"
          @input="getEmail"
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
        注册
      </button>
    </form>
  </view>
</template>

<script>
import { registerUser } from '@/services/user';
import CuCustom from '@/colorui/components/cu-custom.vue';
import getCodeMixin from './mixin/getCodeMixin';

export default {
  components: { CuCustom },
  mixins: [getCodeMixin],
  data() {
    return {
      is_pwd1: true,
      is_pwd2: true,
    };
  },
  methods: {
    ear1() {
      this.is_pwd1 = !this.is_pwd1;
    },

    ear2() {
      this.is_pwd2 = !this.is_pwd2;
    },

    getEmail(e) {
      this.email = e.detail.value;
    },

    // 获取验证码
    getCode() {
      if (this.emailPattern.test(this.email)) {
        this.sendEmCode(this.email);
      } else {
        uni.showToast({
          title: '请填写正确的邮箱！',
          icon: 'error',
        });
      }
    },

    register(e) {
      const {
        username,
        password,
        passwordConfirmed,
        email,
        code,
      } = e.detail.value;

      if (!username || !password || !passwordConfirmed || !email || !code) {
        uni.showToast({
          title: '信息不完整',
          icon: 'error',
        });
        return;
      }

      if (password.length < 6 || password.length > 32) {
        uni.showToast({
          title: '密码长度 6 - 32 位',
          icon: 'error',
        });
        return;
      }

      if (password !== passwordConfirmed) {
        uni.showToast({
          title: '两次密码不相同',
          icon: 'error',
        });
        return;
      }
      registerUser(username, password, email, code).then(() => {
        uni.showToast({
          title: '注册成功',
        });
        uni.navigateBack({
          delta: 1,
        });
      });
    },
  },
};
</script>
<style>

</style>
