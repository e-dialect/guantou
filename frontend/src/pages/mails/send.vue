<template>
  <PageShell
    title="发送消息"
    content-class="mail-send-content"
  >
    <view class="compose-intro">
      <view class="eyebrow">
        站内消息
      </view>
      <view class="intro-title">
        写一则清楚、友好的消息
      </view>
      <view class="intro-copy">
        对方会在消息中心收到提醒；请勿填写手机号等敏感信息。
      </view>
    </view>

    <BaseForm
      ref="form"
      :data="Notification"
      :rules="rules"
    >
      <SectionBlock title="收件人">
        <view
          v-if="recipientLocked"
          class="recipient-card"
        >
          <view
            class="recipient-avatar"
            aria-hidden="true"
          >
            {{ recipientInitial }}
          </view>
          <view class="recipient-copy">
            <view class="recipient-name">
              {{ recipientLabel }}
            </view>
            <view class="recipient-hint">
              {{ recipientHint }}
            </view>
          </view>
          <view class="recipient-status">
            已确认
          </view>
        </view>
        <template v-else>
          <BaseField
            v-model="Notification.recipients[0]"
            name="recipients.0"
            label="收件人编号"
            type="number"
            required
            :error="fieldErrors.recipients"
            placeholder="请输入用户编号"
            @input="clearFieldError('recipients')"
          />
          <view class="field-hint">
            从同乡主页进入时会自动填写；给平台管理员留言可填写 -1。
          </view>
        </template>
      </SectionBlock>

      <SectionBlock title="消息内容">
        <BaseField
          v-model="Notification.title"
          name="title"
          label="标题"
          required
          :error="fieldErrors.title"
          :maxlength="80"
          placeholder="一句话说明来意"
          @input="clearFieldError('title')"
        />
        <BaseField
          v-model="Notification.content"
          name="content"
          label="正文"
          type="textarea"
          required
          :error="fieldErrors.content"
          :maxlength="1000"
          indicator
          placeholder="把需要对方了解的内容写在这里"
          @input="clearFieldError('content')"
        />
      </SectionBlock>

      <view class="submit-panel">
        <view class="submit-note">
          发送后将返回消息中心。
        </view>
        <BaseButton
          block
          aria-label="提交"
          :loading="submitting"
          :disabled="submitting"
          :text="submitting ? '正在发送…' : '发送消息'"
          @click="sendEmail"
        />
      </view>
    </BaseForm>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { notifyError, notifySuccess } from '@/services/feedback';
import { postMail } from '@/services/mail';
import { openPage, ROUTES } from '@/services/navigation';

function blankNotification() {
  return {
    recipients: [''],
    title: '',
    content: '',
  };
}

function fieldMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fieldMessage(value[0]);
  return value.message || value.detail || '';
}

export function mailApiErrors(error) {
  return ['recipients', 'title', 'content'].reduce((result, field) => {
    const message = fieldMessage(error?.data?.[field]);
    return message ? { ...result, [field]: message } : result;
  }, {});
}

export default {
  name: 'SendMailPage',
  components: {
    BaseButton,
    BaseField,
    BaseForm,
    PageShell,
    SectionBlock,
  },
  inheritAttrs: false,
  data() {
    return {
      Notification: blankNotification(),
      fieldErrors: {},
      recipientLocked: false,
      rules: {
        'recipients.0': [
          { required: true, message: '请输入收件人编号' },
          {
            validator: (value) => /^-1$|^[1-9]\d*$/.test(String(value || '')),
            message: '请输入有效的收件人编号',
          },
        ],
        title: [
          { required: true, message: '请输入消息标题' },
          { whitespace: true, message: '请输入消息标题' },
        ],
        content: [
          { required: true, message: '请输入消息正文' },
          { whitespace: true, message: '请输入消息正文' },
        ],
      },
      submitting: false,
    };
  },
  computed: {
    recipientId() {
      return String(this.Notification.recipients[0] || '').trim();
    },
    recipientLabel() {
      return this.recipientId === '-1' ? '平台管理员' : `用户 #${this.recipientId}`;
    },
    recipientHint() {
      return this.recipientId === '-1' ? '平台服务与问题反馈' : '从同乡主页发起';
    },
    recipientInitial() {
      return this.recipientId === '-1' ? '管' : '#';
    },
  },
  onLoad(options = {}) {
    this.applyRecipient(options.id);
    if (options.title) this.Notification.title = decodeURIComponent(options.title);
    if (options.content) {
      this.Notification.content = decodeURIComponent(options.content);
    }
  },
  methods: {
    applyRecipient(id) {
      if (id === undefined || id === null || id === '') return;
      const recipient = String(id);
      this.Notification.recipients = [recipient];
      this.recipientLocked = /^-1$|^[1-9]\d*$/.test(recipient);
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    payload() {
      return {
        recipients: [String(this.Notification.recipients[0]).trim()],
        title: this.Notification.title.trim(),
        content: this.Notification.content.trim(),
      };
    },
    async sendEmail() {
      if (this.submitting) return;
      const valid = await this.$refs.form.validate();
      if (valid !== true) return;

      this.submitting = true;
      try {
        await postMail(this.payload(), true);
        notifySuccess('消息发送成功');
        const recipient = this.Notification.recipients[0];
        this.Notification = blankNotification();
        if (this.recipientLocked) this.Notification.recipients = [recipient];
        this.fieldErrors = {};
        setTimeout(() => openPage(ROUTES.mails, {}, { replace: true }), 500);
      } catch (error) {
        this.fieldErrors = mailApiErrors(error);
        if (!Object.keys(this.fieldErrors).length) notifyError(error, '消息发送失败');
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
:deep(.mail-send-content) {
  padding: var(--space-3) 28rpx var(--space-5);
}

.compose-intro {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.intro-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.intro-copy,
.field-hint,
.submit-note,
.recipient-hint {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.intro-copy {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.recipient-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.recipient-avatar {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-base);
  font-weight: 900;
}

.recipient-copy {
  min-width: 0;
  flex: 1;
}

.recipient-name {
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 800;
}

.recipient-status {
  flex: 0 0 auto;
  padding: 4rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.field-hint {
  margin-top: calc(var(--space-2) * -1);
}

.submit-panel {
  padding-top: var(--space-1);
}

.submit-note {
  margin-bottom: var(--space-2);
  text-align: center;
}
</style>
