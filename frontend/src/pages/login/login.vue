<template>
  <view>
    <cu-custom title="登录" />
    <view class="logo">
      <image
        :src="logo"
        mode="widthFix"
      />
    </view>
    <form @submit="login">
      <view class="info">
        <view class="cuIcon-friend" />
        <input
          name="username"
          placeholder="请输入用户名"
        >
      </view>
      <view class="info">
        <view class="cuIcon-lock" />
        <input
          name="password"
          password
          placeholder="请输入密码"
        >
      </view>
      <view class="flex justify-center">
        <button
          class="cu-btn round bg-gradual-blue shadow text-df margin-top"
          form-type="submit"
          style="width: 65vw"
        >
          登录
        </button>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="flex justify-center">
        <button
          class="cu-btn round bg-gradual-blue shadow text-df margin-top"
          style="width: 65vw"
          @tap="mpLogin()"
        >
          微信一键登录
        </button>
      </view>
      <!-- #endif -->
    </form>
    <view
      class="flex text-bold text-center"
      style="margin-top: 20vh"
    >
      <view
        class="flex-sub solid-right"
        @tap="toForgetPage()"
      >
        忘记密码
      </view>
      <!-- #ifndef MP-WEIXIN -->
      <view
        class="flex-sub solid-right"
        @tap="toRegisterPage()"
      >
        用户注册
      </view>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view
        class="flex-sub"
        @tap="toWechatRegisterPage()"
      >
        微信注册
      </view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script>
import { COS_URL } from '@/const/urls';
import { mpLogin, normalLogin } from '@/services/login';
import { toForgetPage, toRegisterPage, toWechatRegisterPage } from '@/routers/login';
import CuCustom from '@/colorui/components/cu-custom.vue';

export default {
  components: { CuCustom },
  data() {
    return {
      toForgetPage,
      toRegisterPage,
      toWechatRegisterPage,
      logo: `${COS_URL}/images/logo.png`,
    };
  },
  methods: {
    mpLogin,
    login(e) {
      const { username } = e.detail.value;
      const { password } = e.detail.value;
      normalLogin(username, password);
    },
  },
};
</script>
<style>
page {
  background-color: #ffffff;
}

.logo {
  margin-top: 15vh;
  margin-bottom: 5vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo image {
  width: 40vw;
  height: 40vw;
}

.info {
  background-color: var(--white);
  padding: 1rpx 30rpx;
  display: flex;
  align-items: center;
  min-height: 100rpx;
  justify-content: center;
  margin-bottom: 16px;
}

.info input {
  color: #555;
  background-color: #f5f5f5;
  height: 80rpx;
  width: 60vw;
  padding-left: 20rpx;
  border-radius: 10rpx;
  font-size: 32rpx;
  margin-left: 16px;
}

.info > text[class*='cuIcon-'] {
  font-size: 40rpx;
  box-sizing: border-box;
}

</style>
