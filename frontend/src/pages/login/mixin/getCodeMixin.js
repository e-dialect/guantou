import { sendEmailCode } from '@/services/verification';

export default {
  data() {
    return {
      email: '',
      isSending: false,
      count: 30,
      emailPattern: /^[a-z0-9]+([._\\-]*[a-z0-9])*@([a-z0-9]+[-a-z0-9]*[a-z0-9]+.){1,63}[a-z0-9]+$/,
    };
  },
  computed: {
    sendCodeMsg() {
      return !this.isSending ? '获取验证码' : `重新获取(${this.count})`;
    },
  },
  watch: {
    isSending(value) {
      if (value) {
        const timer = setInterval(() => {
          this.count -= 1;
          if (this.count === 0) {
            this.isSending = false;
            this.count = 30;
            clearInterval(timer);
          }
        }, 1000);
      }
    },
  },
  methods: {
    sendEmCode(email, purpose = 'register') {
      sendEmailCode(email, purpose).then(() => {
        // 防止还在发送但未完成状态就已经开始计时
        uni.showToast({
          title: '验证码已发送',
        });
        this.isSending = true;
      });
    },
  },
};
