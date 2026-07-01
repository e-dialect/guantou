<template>
  <view>
    <cu-custom title="修改密码" />
    <form @submit="changePassword">
      <view
        v-for="(item, index) in pwd"
        :key="index"
        class="cu-form-group"
      >
        <view class="text-df text-bold-less margin-right-sm">
          {{ item.str }}
        </view>

        <input
          :name="item.name"
          :password="item.is_pwd"
          :placeholder="item.ph"
        >

        <text
          :class="item.icon"
          :data-index="index"
          @tap="changeStatus"
        />
      </view>
      <button
        class="cu-btn round bg-gradual-blue shadow text-df margin-top-sm"
        style="display: flex; justify-content: center"
        form-type="submit"
      >
        保存
      </button>
    </form>
  </view>
</template>

<script>
import { changeUserPassword } from '@/services/user';

const app = getApp();
export default {
  data() {
    return {
      pwd: [
        {
          str: '原密码',
          ph: '请输入原密码',
          is_pwd: true,
          icon: 'cuIcon-attention',
          name: 'old',
        },
        {
          str: '新密码',
          ph: '请输入新密码',
          is_pwd: true,
          icon: 'cuIcon-attention',
          name: 'new1',
        },
        {
          str: '确认密码',
          ph: '请确认新密码',
          is_pwd: true,
          icon: 'cuIcon-attention',
          name: 'new2',
        },
      ],
    };
  },
  methods: {
    changeStatus(e) {
      const { index } = e.currentTarget.dataset;
      const { pwd } = this;

      if (pwd[index].is_pwd === true) {
        pwd[index].is_pwd = false;
        pwd[index].icon = 'cuIcon-attentionforbid';
      } else {
        pwd[index].is_pwd = true;
        pwd[index].icon = 'cuIcon-attention';
      }

      this.pwd = pwd;
    },

    changePassword(e) {
      const { old } = e.detail.value;
      const new1 = e.detail.value.new1.trim();
      const new2 = e.detail.value.new2.trim();

      if (old === '' || new1 === '' || new2 === '') {
        uni.showToast({
          title: '内容不完整',
          icon: 'error',
        });
        return;
      } if (new1 !== new2) {
        uni.showToast({
          title: '两次密码不一样',
          icon: 'error',
        });
        return;
      } // 修改密码

      changeUserPassword(app.globalData.id, old, new1).then(async () => {
        setTimeout(() => {
          uni.navigateBack({
            delta: 1,
          }); // 返回上一个页面
        }, 1000);
      });
    },
  },
};
</script>
<style>
</style>
