<template>
  <view>
    <cu-custom title="修改用户名" />
    <view class="cu-form-group text-df">
      <view>
        <text class="cuIcon-info" />
        用户名是识别用户的标示并用于账号登录
      </view>
    </view>
    <view class="cu-form-group text-df">
      <view class="text-df text-bold-less margin-right-sm">
        用户名
      </view>
      <input
        v-model="username"
        placeholder="不要超过20位嗷~"
        maxlength="20"
      >
    </view>
    <button
      class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
      style="width: 16vw; margin-left: 80vw"
      @tap="saveUsername"
    >
      保存
    </button>
  </view>
</template>

<script>
import { changeUserInfo } from '@/services/user';
import { toLoginPage } from '@/routers/login';
import CuCustom from '@/colorui/components/cu-custom.vue';

const app = getApp();
export default {
  name: 'ChangeUsername',
  components: { CuCustom },
  data() {
    return {
      username: '',
    };
  },
  computed: {
    currentUsername() {
      return app.globalData.userInfo.username;
    },
  },
  onShow() {
    if (!this.currentUsername) {
      toLoginPage();
    }
    this.username = this.currentUsername;
  },
  methods: {
    async saveUsername() {
      if (this.username === '') {
        uni.showModal({
          content: '请输入正确的用户名',
          showCancel: false,
        });
      } else {
        const userInfo = { ...app.globalData.userInfo };
        userInfo.username = this.username;
        await changeUserInfo(app.globalData.id, userInfo);
        app.globalData.userInfo = userInfo;
        setTimeout(() => {
          uni.navigateBack();
        }, 1500);
      }
    },
  },
};
</script>

<style scoped>

</style>
