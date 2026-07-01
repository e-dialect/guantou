<template>
  <view class="error-page">
    <text class="title">
      页面不存在
    </text>
    <text class="desc">
      您访问的页面不存在，请检查您的链接是否正确
    </text>
    <button
      class="cu-btn bg-black shadow"
      style="width: fit-content"
      @tap="goHome"
    >
      返回首页
    </button>
  </view>
</template>

<script>
import { toIndexPage } from '@/routers';

export default {
  methods: {
    goHome() {
      toIndexPage();
    },
  },
};
</script>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 100rpx;
}

.title {
  font-size: 36rpx;
  margin-top: 30rpx;
}

.desc {
  color: #888;
  margin-top: 20rpx;
}
</style>
