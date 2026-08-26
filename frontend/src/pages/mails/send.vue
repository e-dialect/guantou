<template>
  <PageShell title="发送邮件">
    <BaseForm
      ref="form"
      :data="Notification"
      :rules="rules"
    >
      <BaseField
        v-model="Notification.recipients[0]"
        name="recipients.0"
        label="接收者 ID"
        placeholder="请输入接收者 ID"
        required
      />
      <BaseField
        v-model="Notification.title"
        name="title"
        label="邮件标题"
        placeholder="请输入邮件标题"
        required
      />
      <BaseField
        v-model="Notification.content"
        name="content"
        type="textarea"
        label="邮件内容"
        placeholder="请输入邮件内容"
        required
        :maxlength="2000"
        indicator
      />
      <BaseButton
        block
        text="提交"
        :loading="submitting"
        @click="sendEmail"
      />
    </BaseForm>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import PageShell from '@/components/PageShell.vue';
import { notifyError, notifySuccess } from '@/services/feedback';
import { postMail } from '@/services/mail';

export default {
  name: 'SendMailPage',
  components: {
    BaseButton, BaseField, BaseForm, PageShell,
  },
  data() {
    return {
      Notification: {
        recipients: [''],
        title: '',
        content: '',
      },
      rules: {
        'recipients.0': [
          { required: true, message: '请输入接收者 ID' },
          { whitespace: true, message: '请输入接收者 ID' },
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
    async sendEmail() {
      const valid = await this.$refs.form.validate();
      if (valid !== true || this.submitting) return;
      this.submitting = true;
      try {
        await postMail(this.Notification);
        notifySuccess('邮件发送成功！');
      } catch (error) {
        notifyError(error, '邮件发送失败！');
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
