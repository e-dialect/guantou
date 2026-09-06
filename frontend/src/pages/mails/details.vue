<template>
  <PageShell
    title="消息详情"
    content-class="mail-detail-content"
  >
    <BaseLoading
      v-if="loading"
      text="正在读取消息…"
    />
    <EmptyState
      v-else-if="error"
      title="消息暂时没有加载出来"
      :description="error"
      action-text="重新加载"
      @action="retry"
    />
    <view
      v-else
      class="message-layout"
    >
      <view class="mail-card">
        <view class="mail-header">
          <image
            v-if="email.from.avatar"
            :src="email.from.avatar"
            class="avatar"
            mode="aspectFill"
          />
          <view
            v-else
            class="avatar avatar-fallback"
            aria-hidden="true"
          >
            {{ senderInitial }}
          </view>
          <view class="sender-info">
            <view class="sender-label">
              来自
            </view>
            <view class="nickname">
              {{ email.from.nickname || '乡声集盒' }}
            </view>
          </view>
        </view>

        <view class="mail-meta">
          <text
            class="status-badge"
            :class="{ read: !email.unread }"
          >
            {{ email.unread ? '未读消息' : '已读消息' }}
          </text>
          <text class="time">
            {{ email.time }}
          </text>
        </view>

        <view class="mail-title">
          {{ email.title }}
        </view>
        <view class="mail-divider" />
        <view class="mail-text">
          {{ email.content || '这则消息没有附加正文。' }}
        </view>
      </view>

      <view
        v-if="email.target?.url"
        class="related-card"
      >
        <view>
          <view class="related-eyebrow">
            相关内容
          </view>
          <view class="related-title">
            {{ targetDescription }}
          </view>
        </view>
        <BaseButton
          size="small"
          :text="targetActionText"
          @click="openTarget"
        />
      </view>

      <view
        v-if="canReply"
        class="reply-card"
      >
        <view class="reply-copy">
          想继续聊聊？回复时会自动带上收件人和原消息标题。
        </view>
        <BaseButton
          block
          variant="ghost"
          text="回复这则消息"
          @click="reply"
        />
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { getMailDetails } from '@/services/mail';
import { goMailSend, openPage } from '@/services/navigation';

const TARGET_COPY = {
  entry: ['这则消息关联到一个词条。', '查看相关词条'],
  recording: ['这则消息关联到一段乡音。', '收听相关乡音'],
  user: ['这则消息关联到一位同乡。', '查看同乡主页'],
};

export default {
  name: 'MailDetailsPage',
  components: {
    BaseButton, BaseLoading, EmptyState, PageShell,
  },
  data() {
    return {
      loading: true,
      error: '',
      mailId: 0,
      email: {
        from: { id: 0, nickname: '', avatar: '' },
        to: { id: 0, nickname: '', avatar: '' },
        time: '',
        title: '',
        content: '',
        unread: false,
        target: null,
      },
    };
  },
  computed: {
    senderInitial() {
      return String(this.email.from?.nickname || '乡').trim().slice(0, 1) || '乡';
    },
    canReply() {
      return Number(this.email.from?.id) > 0;
    },
    targetCopy() {
      return TARGET_COPY[this.email.target?.type] || ['这则消息附带了可继续查看的内容。', '查看相关内容'];
    },
    targetDescription() {
      return this.targetCopy[0];
    },
    targetActionText() {
      return this.targetCopy[1];
    },
  },
  onLoad(options) {
    this.mailId = Number(options.id || 0);
    this.load(this.mailId);
  },
  methods: {
    retry() {
      this.load(this.mailId);
    },
    openTarget() {
      if (this.email.target?.url) openPage(this.email.target.url);
    },
    reply() {
      if (!this.canReply) return;
      const title = this.email.title ? `回复：${this.email.title}` : '回复消息';
      goMailSend(this.email.from.id, { title });
    },
    async load(id) {
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

.message-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.mail-card,
.related-card,
.reply-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.mail-card {
  padding: var(--space-4);
}

.mail-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.avatar {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-subtle-color);
}

.avatar-fallback {
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-lg);
  font-weight: 900;
}

.sender-info {
  min-width: 0;
  flex: 1;
}

.sender-label,
.related-eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.nickname {
  margin-top: 2rpx;
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.mail-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.status-badge {
  padding: 2rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--danger-subtle-color);
  color: var(--danger-color);
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
  margin-top: var(--space-3);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.4;
}

.mail-divider {
  width: 72rpx;
  height: 4rpx;
  margin-top: var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--accent-color);
}

.mail-text {
  margin-top: var(--space-3);
  color: var(--text-secondary-color);
  font-size: var(--font-size-base);
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.related-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--accent-subtle-color);
}

.related-title {
  margin-top: 4rpx;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.reply-card {
  padding: var(--space-3);
}

.reply-copy {
  margin-bottom: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
</style>
