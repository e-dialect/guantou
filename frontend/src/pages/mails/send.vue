<template>
  <PageShell title="发送邮件">
    <SectionBlock title="填写邮件">
      <BaseForm
        ref="form"
        :data="Notification"
        :rules="rules"
      >
        <BaseField
          v-model="Notification.recipients[0]"
          name="recipients.0"
          label="接收者 ID"
          type="number"
          required
          :error="fieldErrors.recipients"
          placeholder="请输入接收者 ID"
          @input="clearFieldError('recipients')"
        />
        <view class="field-hint">
          输入用户 ID；填写 -1 时将发送给平台管理员。
        </view>

        <BaseField
          v-model="Notification.title"
          name="title"
          label="邮件标题"
          required
          :error="fieldErrors.title"
          :maxlength="80"
          placeholder="请输入邮件标题"
          @input="clearFieldError('title')"
        />
        <BaseField
          v-model="Notification.content"
          name="content"
          label="邮件内容"
          type="textarea"
          required
          :error="fieldErrors.content"
          :maxlength="1000"
          indicator
          placeholder="请输入邮件内容"
          @input="clearFieldError('content')"
        />

        <view class="submit-action">
          <BaseButton
            block
            :loading="submitting"
            :disabled="submitting"
            :text="submitting ? '发送中…' : '发送邮件'"
            @click="sendEmail"
          />
        </view>
      </BaseForm>
    </SectionBlock>
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
  data() {
    return {
      Notification: blankNotification(),
      fieldErrors: {},
      rules: {
        'recipients.0': [
          { required: true, message: '请输入接收者 ID' },
          {
            validator: (value) => /^-1$|^[1-9]\d*$/.test(String(value || '')),
            message: '请输入有效的接收者 ID',
          },
        ],
        title: [
          { required: true, message: '请输入邮件标题' },
          { whitespace: true, message: '请输入邮件标题' },
        ],
        content: [
          { required: true, message: '请输入邮件内容' },
          { whitespace: true, message: '请输入邮件内容' },
        ],
      },
      submitting: false,
    };
  },
  methods: {
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
        notifySuccess('邮件发送成功');
        this.Notification = blankNotification();
        setTimeout(() => openPage(ROUTES.mails, {}, { replace: true }), 500);
      } catch (error) {
        this.fieldErrors = mailApiErrors(error);
        if (!Object.keys(this.fieldErrors).length) notifyError(error, '邮件发送失败');
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.field-hint {
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.submit-action {
  margin-top: var(--space-4);
}
</style>
