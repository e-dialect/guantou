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
        mode="multiSelector"
        :value="multiIndex"
        :range="multiArray"
        @change="multiChange"
        @columnchange="columnChange"
      >
        <view class="picker text-grey">
          <text>{{ multiArray[0][multiIndex[0]] }} {{ multiArray[1][multiIndex[1]] }}</text>
        </view>
      </picker>
    </view>
  </view>
</template>

<script>
import { changeUserInfo, getUserInfo } from '@/services/user';
import { uploadFile } from '@/services/file';
import {
  toChangeEmailPage, toChangeNicknamePage, toChangePhonePage, toChangeUsernamePage,
} from '@/routers/user';

const app = getApp();
const counties = ['城厢区', '涵江区', '荔城区', '秀屿区', '仙游县'];
const towns = [
  ['龙桥街道', '凤凰山街道', '霞林街道', '常太镇', '华亭镇', '灵川镇', '东海镇'],
  ['涵东街道', '涵西街道', '三江口镇', '白塘镇', '国欢镇', '梧塘镇', '江口镇', '萩芦镇', '白沙镇', '庄边镇', '新县镇', '大洋乡'],
  ['镇海街道', '拱辰街道', '西天尾镇', '黄石镇', '新度镇', '北高镇'],
  ['笏石镇', '东庄镇', '忠门镇', '东埔镇', '东峤镇', '埭头镇', '平海镇', '南日镇', '湄洲镇', '山亭镇', '月塘乡'],
  ['鲤城街道', '枫亭镇', '榜头镇', '郊尾镇', '度尾镇', '鲤南镇', '赖店镇', '盖尾镇', '园庄镇', '大济镇', '龙华镇', '钟山镇', '游洋镇', '西苑乡', '石苍乡', '社硎乡', '书峰乡', '菜溪乡'],
];
export default {
  data() {
    return {
      user: [],
      date: '未知',
      multiIndex: [0, 0],
      multiArray: [counties, towns[0]],
    };
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
      const userInfo = await getUserInfo(app.globalData.id);
      this.user = { ...userInfo.user };
      if (userInfo.user.birthday) {
        this.date = userInfo.user.birthday;
      }
      if (userInfo.user.birthday) {
        const index0 = counties.indexOf(userInfo.user.county);
        const index1 = towns[index0].indexOf(userInfo.user.town);
        const { multiArray } = this;
        multiArray[1] = towns[index0];
        this.multiIndex = [index0, index1];
        this.multiArray = multiArray;
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
     * 更改区县选择
     * @returns {Promise<void>}
     */
    async multiChange(e) {
      this.multiIndex = e.detail.value;
      const userInfo = await getUserInfo(app.globalData.id);
      userInfo.user.county = this.multiArray[0][this.multiIndex[0]];
      userInfo.user.town = this.multiArray[1][this.multiIndex[1]];
      await changeUserInfo(app.globalData.id, userInfo.user);
    },

    /**
     * 切换县区/乡镇列表
     * @returns {Promise<void>}
     */
    columnChange(e) {
      switch (e.detail.column) {
        // 如果是修改县区
        case 0:
          this.multiArray[1] = [...towns[e.detail.value]]; // 更新乡镇列表
          this.multiIndex = [e.detail.value, 0]; // 重置乡镇选择
          break;
        // 如果是修改乡镇
        case 1:
          this.multiIndex.splice(1, 1, e.detail.value);
          break;
        default:
          uni.showToast({
            title: '出错了',
            icon: 'none',
          });
          break;
      }
    },
  },
};
</script>
<style></style>
