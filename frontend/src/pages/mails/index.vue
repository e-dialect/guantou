<template>
  <view>
    <cu-custom title="邮箱列表" />
    <scroll-view
      :scroll-y="true"
      style="height: 85vh"
      :refresher-enabled="true"
      refresher-default-style="none"
      refresher-background="white"
      :refresher-triggered="triggered"
      @refresherpulling="onPulling"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMoreEmails"
    >
      <view class="email-list">
        <!--view
          v-if="emails.length||emails.length === 0"
          class="empty-message"
        >
          当前没有新的消息哦
        </view-->
        <view
          v-for="email in showEmails"
          :key="email.id"
          @click="viewEmail(email.id)"
        >
          <view class="email-item">
            <view class="email-title">
              {{ email.title }}
            </view>
            <img
              :src="email.from.avatar"
              class="email-avatar"
              alt="Avatar"
            >
            <view class="email-info">
              <view class="email-nickname">
                {{ email.from.nickname }}
              </view>
              <view class="email-time">
                {{ email.time }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    <!-- 暂时关闭发送通知功能 -->
    <!-- <view class="send-button">
      <button @click="sendNotification">
        发送通知
      </button>
    </view> -->
  </view>
</template>
<script>
import { getAllMails } from '@/services/mail';

export default {
  data() {
    return {
      showEmails: [],
      triggered: false,
      page: 1,
      freshing: false,
    };
  },
  async onLoad() {
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    });
    await this.loadEmails();
  },
  methods: {
    async loadEmails() {
      // console.log(app.globalData.id);
      // console.log(this.page);
      const res = await getAllMails(this.page);
      this.showEmails = res.notifications;
      this.freshing = false;
    },
    viewEmail(id) {
      uni.navigateTo({
        url: `./details?id=${id}`,
      });
    },
    async sendNotification() {
      uni.navigateTo({
        url: './send',
      });
    },
    onPulling() {
      this.triggered = true;
    },

    // 下拉刷新
    onRefresh() {
      if (this.freshing) {
        return;
      }
      this.freshing = true;
      this.loadEmails();
      setTimeout(() => {
        this.triggered = false;
        this.freshing = false;
      }, 500);
    },

    // 加载更多邮件
    loadMoreEmails() {
      uni.showLoading();
      const originEmails = this.showEmails;
      getAllMails(this.page + 1).then((res) => {
        this.showEmails = originEmails.concat(res.notifications);
        this.page += 1;
        /* console.log('showEmails:', this.showEmails);
        console.log('page:', this.page); */
        setTimeout(() => {
          uni.hideLoading();
        }, 500);
      });
      // 打印一下当前page和showEmails
    },
  },
};
</script>

<style scoped>
.email-list {
  padding: 20px;
}

.email-item {
  border-radius: 10px;
  padding: 10px;
  border: 1px solid #ccc;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.email-item:hover {
  background-color: #f4f4f4;
}

.email-title {
  font-weight: bold;
  font-size: 24px;
}

.email-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 5px;
  color: #666;
}

.email-nickname {
  font-size: 14px;
}

.email-time {
  font-size: 12px;
}

.email-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.empty-message {
  text-align: center;
  font-size: 16px;
  color: #999;
  margin-top: 20px;
}

.send-button {
  text-align: center;
  position: fixed;
  bottom: 20px;
  left: 15%;
  width: 70%;
}

.send-button button {
  background-color: #39C5BB;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.send-button button:hover {
  background-color: #2fa299;
}
</style>
