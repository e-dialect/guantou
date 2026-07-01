<template>
  <view>
    <cu-custom title="我的消息" />
    <view class="mail-detail">
      <view class="mail-header">
        <img
          :src="email.from.avatar"
          class="avatar"
          alt="Avatar"
        >
        <view class="sender-info">
          <view class="nickname">
            {{ email.from.nickname }}
          </view>
          <view class="time">
            {{ email.time }}
          </view>
        </view>
      </view>
      <view class="mail-content">
        <view class="mail-title">
          {{ email.title }}
        </view>
        <view class="mail-text">
          {{ email.content }}
        </view>
      </view>
    </view>
  </view>
</template>
<script>
import { getMailDetails } from '@/services/mail';

export default {
  data() {
    return {
      email: {
        from: {
          nickname: '',
          avatar: '',
          id: 0,
        },
        to: {
          nickname: '',
          avatar: '',
          id: 0,
        },
        time: '',
        title: '',
        content: '',
        public: true,
        id: 0,
      },
    };
  },
  async onLoad(options) {
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    });
    const { id } = options;
    await this.getDetails(id);
  },
  methods: {
    async getDetails(id) {
      const res = await getMailDetails(id);
      this.email = res;
    },
  },
};
</script>

<style scoped>
.mail-detail {
  padding: 20px;
}

.mail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 10px;
}

.sender-info {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-weight: bold;
  font-size: 18px;
}

.time {
  color: #999;
}

.mail-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
}

.mail-text {
  font-size: 16px;
  line-height: 1.5;
}
</style>
