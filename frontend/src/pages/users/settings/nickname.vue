<template>
  <view>
    <cu-custom title="修改昵称" />
    <view class="cu-form-group text-df">
      <view>
        <text class="cuIcon-info" />
        昵称用于用户之间的交流经常展示
      </view>
    </view>
    <view class="cu-form-group text-df">
      <view class="text-df text-bold-less margin-right-sm">
        昵称
      </view>
      <input
        v-model="nickname"
        placeholder="不要超过20位嗷~"
        maxlength="20"
      >
    </view>
    <button
      class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
      style="width: 16vw; margin-left: 80vw"
      :disabled="nickname===currentNickname"
      @tap="saveNickname"
    >
      保存
    </button>
  </view>
</template>

<script>
import { changeUserInfo } from '@/services/user';
import { toLoginPage } from '@/routers/login';

const app = getApp();
export default {
  data() {
    return {
      nickname: '',
    };
  },
  computed: {
    currentNickname() {
      return app.globalData.userInfo.nickname;
    },
  },
  onShow() {
    if (!this.currentNickname) {
      toLoginPage();
    }
    this.nickname = this.currentNickname;
  },
  methods: {
    /**
     * 保存昵称
     * @returns {Promise<void>}
     */
    async saveNickname() {
      if (this.nickname === '') {
        uni.showModal({
          content: '请输入正确的昵称',
          showCancel: false,
        });
      } else {
        const userInfo = { ...app.globalData.userInfo };
        userInfo.nickname = this.nickname;
        await changeUserInfo(app.globalData.id, userInfo);
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
      }
    },
  },
};
</script>
<style>
</style>
