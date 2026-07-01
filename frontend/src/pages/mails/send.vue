<template>
  <view>
    <cu-custom title="发送邮件" />
    <view class="send-email">
      <view class="email-form">
        <label class="input-label">接收者ID</label>
        <input
          v-model="Notification.recipients[0]"
          placeholder="请输入接收者ID"
          class="input-field input-field-tall"
        >
        <label class="input-label">邮件标题</label>
        <input
          v-model="Notification.title"
          placeholder="请输入邮件标题"
          class="input-field input-field-tall"
        >

        <label class="input-label">邮件内容</label>
        <textarea
          v-model="Notification.content"
          placeholder="请输入邮件内容"
          class="input-field"
        />

        <button
          class="submit-button"
          @click="sendEmail"
        >
          提交
        </button>
      </view>
    </view>
  </view>
</template>
<script>
import { postMail } from '@/services/mail';

export default {
  data() {
    return {
      Notification: {
        recipients: [],
        title: '',
        content: '',
      },
    };
  },
  methods: {
    async sendEmail() {
      postMail(this.Notification).then(() => {
        uni.showToast({
          title: '邮件发送成功！',
          icon: 'success',
        });
        // 清空表单
        this.receiverId = '';
        this.emailTitle = '';
        this.emailContent = '';
      }).catch(() => {
        uni.showToast({
          title: '邮件发送失败!',
          icon: 'none',
        });
      });
    },
  },
};
</script>

<style scoped>
.input-label {
  font-size: 14px;
  margin-bottom: 5px;
  color: #333;
  font-weight: bold;
  text-transform: uppercase;
  font-family: "Arial", "Microsoft YaHei", "黑体", "宋体", sans-serif;
}

.send-email {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
}

.email-form {
  background-color: #fff;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
}

.input-field {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

textarea {
  resize: vertical;
  height: 150px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.submit-button {
  background-color: #39c5bb;
  color: white;
  padding: 12px 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  transition: background-color 0.3s;
}

.submit-button:hover {
  background-color: #2e9e95;
}

@media screen and (max-width: 768px) {
  .email-form {
    padding: 20px;
  }
}

/* 调整输入框高度 */
.input-field-tall {
  height: 40px;
}
</style>
