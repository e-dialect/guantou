<template>
  <PageShell
    title="我的消息"
    content-class="mail-detail-content"
  >
    <view
      v-if="loading"
      class="state"
    >
      正在加载消息…
    </view>
    <view
      v-else-if="error"
      class="state error"
      @tap="load"
    >
      {{ error }}，点此重试
    </view>
    <view
      v-else
      class="mail-card"
    >
      <view class="mail-header">
        <image
          :src="email.from.avatar"
          class="avatar"
          mode="aspectFill"
        />
        <view class="sender-info">
          <view class="nickname">
            {{ email.from.nickname }}
          </view>
          <view class="meta-row">
            <text
              class="status-badge"
              :class="{ read: !email.unread }"
            >
              {{ email.unread ? '未读' : '已读' }}
            </text>
            <text class="time">
              {{ email.time }}
            </text>
          </view>
        </view>
      </view>
      <view class="mail-title">
        {{ email.title }}
      </view>
      <view class="mail-text">
        {{ email.content || '（暂无内容）' }}
      </view>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import { getMailDetails } from '@/services/mail';

export default {
  name: 'MailDetailsPage',
  components: { PageShell },
  data() {
    return {
      loading: true,
      error: '',
      email: {
        from: { nickname: '', avatar: '' },
        to: { nickname: '', avatar: '' },
        time: '',
        title: '',
        content: '',
        unread: false,
        id: 0,
      },
    };
  },
  onLoad(options) {
    this.load(Number(options.id));
  },
  methods: {
    async load(id = this.email.id) {
      this.loading = true;
      this.error = '';
      try {
        this.email = await getMailDetails(id);
      } catch (error) {
        this.error = error.message || '消息加载失败';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
:deep(.mail-detail-content) {
  padding: var(--space-3) 28rpx var(--space-5);
}

.mail-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.mail-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.sender-info {
  min-width: 0;
  flex: 1;
}

.nickname {
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 6rpx;
}

.status-badge {
  padding: 2rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.status-badge.read {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.time {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.mail-title {
  margin-top: var(--space-4);
  color: var(--text-color);
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: 1.4;
}

.mail-text {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  font-size: var(--font-size-base);
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.state {
  padding: 90rpx var(--space-3);
  color: var(--muted-color);
  text-align: center;
}

.state.error {
  color: var(--danger-color);
}
</style>
