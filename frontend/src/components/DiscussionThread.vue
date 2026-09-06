<template>
  <view class="box-panel">
    <text class="box-heading">
      {{ targetType === 'entry' ? '词条讨论' : '乡音留言' }}
    </text><text class="box-note">
      讨论用法与证据；留言和点赞不代表词条认证。
    </text>
    <BaseLoading
      v-if="commentsLoading"
      text="正在读取留言…"
    />
    <EmptyState
      v-else-if="commentsError"
      :title="commentsError"
      action-text="重试"
      @action="loadComments"
    />
    <text
      v-if="!commentsLoading && !commentsError && !comments.length"
      class="box-note"
    >
      还没有留言，聊聊你听到的乡音。
    </text>
    <view
      v-for="comment in comments"
      :key="comment.id"
      class="box-recording"
      :class="{ 'box-reply': comment.parent_id }"
    >
      <text class="box-heading">
        {{ comment.author_name }}
      </text>
      <text
        v-if="comment.parent_id"
        class="box-note"
      >
        回复 {{ parentName(comment.parent_id) }}
      </text>
      <text>{{ comment.body }}</text>
      <view class="box-actions">
        <BaseButton
          size="small"
          variant="ghost"
          :text="`${comment.liked ? '已赞' : '赞'} ${comment.like_count}`"
          :disabled="busy"
          @click="toggleCommentLike(comment)"
        />
        <BaseButton
          v-if="!comment.parent_id"
          size="small"
          variant="ghost"
          text="回复"
          @click="replyTo(comment)"
        />
        <BaseButton
          v-if="comment.editable"
          size="small"
          variant="danger-ghost"
          text="删除留言"
          :disabled="busy"
          @click="removeComment(comment)"
        />
      </view>
    </view>
    <BaseButton
      v-if="commentsNext"
      variant="ghost"
      text="更多留言"
      :disabled="commentsLoading"
      @click="loadComments(true)"
    />
    <BaseForm
      ref="commentForm"
      :data="form"
      :rules="rules"
    >
      <view
        v-if="reply"
        class="box-actions"
      >
        <text>回复 {{ reply.author_name }}</text><BaseButton
          size="small"
          variant="ghost"
          text="取消回复"
          @click="reply = null"
        />
      </view>
      <BaseField
        v-model="form.body"
        name="body"
        label="写一条留言"
        type="textarea"
        placeholder="你那里怎么说？"
      />
      <BaseButton
        text="发送留言"
        :loading="sending"
        @click="send"
      />
    </BaseForm>
  </view>
</template>
<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import { pageResults } from '@/services/entryRecording';
import {
  listComments, createComment, deleteComment, likeComment, commentRequestId,
} from '@/services/recordingSocial';
import { requireAuth } from '@/services/authGuard';
import { notify, confirm } from '@/services/feedback';

export default {
  components: {
    BaseButton, BaseForm, BaseField, BaseLoading, EmptyState,
  },
  props: {
    targetId: { type: [Number, String], required: true },
    targetType: { type: String, default: 'recording', validator: (value) => ['entry', 'recording'].includes(value) },
  },
  data: () => ({
    busy: false,
    comments: [],
    commentsPage: 1,
    commentsNext: null,
    commentsLoading: false,
    commentsError: '',
    sending: false,
    reply: null,
    requestId: '',
    requestSignature: '',
    form: { body: '' },
    rules: { body: [{ required: true, message: '先写下想说的话' }] },
  }),
  mounted() { this.loadComments(); },
  methods: {
    auth() { return requireAuth(this.targetType === 'entry' ? 'interact_entry' : 'interact_recording', { [`${this.targetType}Id`]: this.targetId }); },
    parentName(id) {
      return this.comments.find((item) => item.id === id)?.author_name || '前面的留言';
    },
    async loadComments(more = false) {
      if (this.commentsLoading) return;
      this.commentsLoading = true;
      this.commentsError = '';
      const page = more === true ? this.commentsPage + 1 : 1;
      try {
        const response = await listComments(this.targetId, page, this.targetType);
        this.comments = page === 1
          ? pageResults(response) : [...this.comments, ...pageResults(response)];
        this.commentsPage = page;
        this.commentsNext = response.next;
      } catch (error) {
        this.commentsError = '留言暂时无法读取';
      } finally {
        this.commentsLoading = false;
      }
    },
    replyTo(comment) {
      if (this.auth()) this.reply = comment;
    },
    async send() {
      if (this.sending || !this.auth()) return;
      if (await this.$refs.commentForm.validate() !== true) return;
      this.sending = true;
      const signature = JSON.stringify([this.form.body.trim(), this.reply?.id || null]);
      if (signature !== this.requestSignature) {
        this.requestSignature = signature;
        this.requestId = commentRequestId();
      }
      try {
        await createComment({
          [`${this.targetType}_id`]: this.targetId,
          parent_id: this.reply?.id || null,
          body: this.form.body.trim(),
          client_id: this.requestId,
        }, this.targetType);
        this.form.body = '';
        this.reply = null;
        this.requestSignature = '';
        this.requestId = '';
        await this.loadComments();
        notify({
          title: '留言已发送',
        });
      } catch (error) {
        notify({
          title: error.message || '发送失败，文字已保留，可重试',
        });
      } finally {
        this.sending = false;
      }
    },
    async toggleCommentLike(comment) {
      if (this.busy || !this.auth()) return;
      this.busy = true;
      try {
        Object.assign(comment, await likeComment(comment.id, !comment.liked, this.targetType));
      } catch (error) {
        notify({
          title: '点赞失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    async removeComment(comment) {
      if (!(await confirm({
        title: '删除这条留言？',
        content: '这条留言及其回复将不再展示。',
        danger: true,
      }))) return;
      this.busy = true;
      try {
        await deleteComment(comment.id, this.targetType);
        await this.loadComments();
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
