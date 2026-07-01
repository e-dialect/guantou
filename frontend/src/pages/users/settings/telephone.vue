<template>
  <view>
    <cu-custom title="修改手机" />
    <view class="cu-form-group">
      <view class="text-df text-bold-less margin-right-sm">
        手机
      </view>
      <input
        v-model="telephone"
        placeholder="请输入11位手机号嗷~"
        maxlength="11"
      >
    </view>
    <button
      class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
      style="width: 16vw; margin-left: 80vw"
      :disabled="currentTelephone===telephone"
      @tap="savePhone"
    >
      保存
    </button>
  </view>
</template>

<script>
import { changeUserInfo, getUserInfo } from '@/services/user';

const app = getApp();
export default {
  data() {
    return {
      telephone: app.globalData.userInfo.telephone,
    };
  },
  computed: {
    currentTelephone() {
      return app.globalData.userInfo.telephone;
    },
  },
  methods: {
    /**
     * 更改手机号
     */
    async savePhone() {
      const userInfo = await getUserInfo(app.globalData.id);
      userInfo.user.telephone = this.telephone;
      if (this.telephone.length !== 11) {
        uni.showModal({
          title: '提示',
          content: '请输入正确格式的手机号码',
          showCancel: false,
        });
      } else {
        changeUserInfo(app.globalData.id, userInfo.user).then(async () => {
          setTimeout(() => {
            // 返回上一个页面
            uni.navigateBack();
          }, 1000);
        });
      }
    },
  },
};
</script>
<style>
</style>
