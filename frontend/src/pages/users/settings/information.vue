<template>
  <view>
    <cu-custom
      title="个人信息"
      :is-back="true"
    />
    <view>
      <view
        class="cu-form-group padding"
      >
        <view class="title">
          头像
        </view>
        <view>
          <button
            class="margin-right-xs cu-avatar lg round"
            open-type="chooseAvatar"
            @chooseavatar="onChooseAvatar"
          >
            <image
              :class="user.avatar === ''?'avatar-img':'' "
              :src="user.avatar"
              class="cu-avatar lg round"
              mode="aspectFill"
            />
          </button>
          <text class="cuIcon-right text-gray" />
        </view>
      </view>

      <view
        class="cu-form-group"
        @tap="toChangeUsernamePage"
      >
        <view class="title">
          用户名
        </view>
        <view class="text-grey">
          {{ user.username }}
          <text class="cuIcon-right text-gray" />
        </view>
      </view>

      <view
        class="cu-form-group"
        @tap="toChangeNicknamePage"
      >
        <view class="title">
          昵称
        </view>
        <view class="text-grey">
          {{ user.nickname }}
          <text class="cuIcon-right" />
        </view>
      </view>

      <view
        class="cu-form-group"
        @tap="toChangeEmailPage"
      >
        <view class="title">
          邮箱
        </view>
        <view class="text-grey">
          {{ user.email }}
          <text class="cuIcon-right text-gray" />
        </view>
      </view>
    </view>

    <!--个人信息-->
    <view
      class="cu-form-group padding-top-xl"
      style="background-color: #f7f7f7"
    >
      <view class="text-df text-gray">
        个人信息（将会默认公开）
      </view>
    </view>
    <!--  #ifndef  MP-WEIXIN -->
    <view
      class="cu-form-group"
      @tap="toChangePhonePage"
    >
      <view class="title">
        手机
      </view>
      <view class="text-grey">
        {{ user.telephone }}
        <text class="cuIcon-right text-gray" />
      </view>
    </view>
    <!--  #endif -->

    <!--  #ifndef  MP-WEIXIN -->
    <view class="cu-form-group">
      <view class="title">
        生日
      </view>
      <picker
        mode="date"
        :value="date"
        start="1960-09-01"
        end="2020-09-01"
        @change="changeDate"
      >
        <view class="picker text-grey">
          {{ date }}
        </view>
      </picker>
    </view>
    <!--  #endif -->

    <view class="cu-form-group">
      <view class="title">
        发音默认地点
      </view>
      <picker
        mode="selector"
        :value="dialectIndex"
        :range="dialectLabels"
        @change="dialectChange"
      >
        <view class="picker text-grey">
          <text>{{ selectedDialectLabel }}</text>
        </view>
      </picker>
    </view>
  </view>
</template>

<script>
import { changeUserInfo, getUserInfo } from '@/services/user';
import { uploadFile } from '@/services/file';
import { listAllDialects } from '@/services/guantou';
import {
  toChangeEmailPage, toChangeNicknamePage, toChangePhonePage, toChangeUsernamePage,
} from '@/routers/user';

const app = getApp();
export default {
  data() {
    return {
      user: [],
      date: '未知',
      dialectIndex: -1,
      dialectOptions: [],
    };
  },
  computed: {
    dialectLabels() {
      return this.dialectOptions.map((dialect) => dialect.qualified_code || dialect.name);
    },
    selectedDialectLabel() {
      return this.dialectLabels[this.dialectIndex] || '未填写方言点';
    },
  },
  onShow() {
    this.getInfo();
  },
  methods: {
    toChangeNicknamePage,
    toChangeEmailPage,
    toChangePhonePage,
    toChangeUsernamePage,
    /**
     * 获取用户信息
     * @returns {Promise<void>}
     */
    async getInfo() {
      this.dialectOptions = await listAllDialects();
      const userInfo = await getUserInfo(app.globalData.id);
      this.user = { ...userInfo.user };
      if (userInfo.user.birthday) {
        this.date = userInfo.user.birthday;
      }
      if (userInfo.user.primary_dialect) {
        const selectedIndex = this.dialectOptions.findIndex(
          (dialect) => dialect.id === userInfo.user.primary_dialect.id,
        );
        this.dialectIndex = selectedIndex;
      }
    },

    /**
     * 上传头像
     * @returns {Promise<void>}
     */
    async onChooseAvatar(e) {
      const { url } = await uploadFile(e.detail.avatarUrl);
      const userInfo = await getUserInfo(app.globalData.id);
      this.user.avatar = url;
      userInfo.user.avatar = url;
      await changeUserInfo(app.globalData.id, userInfo.user);
    },

    /**
     * 更改生日
     * @returns {Promise<void>}
     */
    async changeDate(e) {
      this.date = e.detail.value;
      const userInfo = await getUserInfo(app.globalData.id);
      userInfo.user.birthday = e.detail.value;
      await changeUserInfo(app.globalData.id, userInfo.user);
    },

    /**
     * 更改默认方言点
     * @returns {Promise<void>}
     */
    async dialectChange(e) {
      this.dialectIndex = Number(e.detail.value);
      const dialect = this.dialectOptions[this.dialectIndex];
      if (!dialect) return;
      const userInfo = await getUserInfo(app.globalData.id);
      userInfo.user.primary_dialect_id = dialect.id;
      await changeUserInfo(app.globalData.id, userInfo.user);
    },
  },
};
</script>
<style></style>
