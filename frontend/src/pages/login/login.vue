<template>
  <view class="page">
    <cu-custom title="微信登录" />

    <view class="logo">
      <image
        :src="logo"
        mode="widthFix"
      />
    </view>

    <view class="intro">
      <view class="title">
        微信一键登录
      </view>
      <view class="desc">
        使用微信授权进入方言罐头。
      </view>
    </view>

    <view class="flex justify-center">
      <button
        class="cu-btn round bg-gradual-blue shadow text-df margin-top"
        style="width: 65vw"
        @tap="toWechatLoginPage()"
      >
        微信一键登录
      </button>
    </view>
  </view>
</template>

<script>
import { COS_URL } from '@/const/urls';
import { toWechatLoginPage } from '@/routers/login';
import CuCustom from '@/colorui/components/cu-custom.vue';

export default {
  components: { CuCustom },
  data() {
    return {
      logo: `${COS_URL}/images/logo.png`,
      toWechatLoginPage,
    };
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
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

.intro {
  padding: 0 60rpx;
  text-align: center;
}

.title {
  color: #1d2a24;
  font-size: 42rpx;
  font-weight: 800;
}

.desc {
  margin-top: 16rpx;
  color: #7a867d;
  font-size: 28rpx;
}
</style>
