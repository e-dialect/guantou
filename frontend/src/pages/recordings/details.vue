<template>
  <PageShell title="一段乡音">
    <BaseLoading
      v-if="loading"
      text="正在读取乡音…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      action-text="重试"
      @action="load"
    />
    <view
      v-else-if="recording"
      class="box-stack"
    >
      <view class="box-cover">
        <text class="box-kicker">
          乡声集盒 · 听见一个地方
        </text>
        <text class="box-title">
          {{ recording.original_gloss || '一段待整理的乡音' }}
        </text>
        <text>{{ dialectLabel(recording.usage_dialect) }} · {{ recorderName }}</text>
        <text class="box-note">
          {{ recording.rights_statement || '录制者暂未补充引用授权说明' }}
        </text>
      </view>
      <view class="box-panel">
        <EntryRecordingCard
          :detail-link="false"
          :community="false"
          :recording="recording"
          @open-entry="goEntryDetail"
          @continue="recordFor"
        />
        <view class="box-actions">
          <BaseButton
            :variant="recording.liked ? 'primary' : 'ghost'"
            :text="`${recording.liked ? '已赞' : '赞'} · ${recording.like_count || 0}`"
            :disabled="busy"
            @click="toggleLike"
          />
          <BaseButton
            v-if="recording.visibility"
            variant="ghost"
            :open-type="shareType"
            text="分享乡音"
            @click="share"
          />
        </view>
        <CollectionPicker :recording="recording" />
      </view>
      <view class="box-panel">
        <text class="box-heading">
          关联词条
        </text>
        <text
          v-if="!recording.entry_links?.length"
          class="box-note"
        >
          写法还在整理中，先听听贡献者的原话。
        </text>
        <BaseButton
          v-for="link in recording.entry_links"
          :key="link.id"
          variant="ghost"
          :text="`${entryTitle(link.entry)} · ${linkLabel(link)}`"
          @click="goEntryDetail(link.entry.id)"
        />
      </view>
      <view class="box-panel">
        <text class="box-heading">
          乡音留言
        </text><text class="box-note">
          分享听到的用法与记忆；留言和点赞不代表词条认证。
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
    </view>
  </PageShell>
</template>
<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import CollectionPicker from '@/components/CollectionPicker.vue';
import {
  getRecording, entryTitle, dialectLabel, pageResults,
} from '@/services/entryRecording';
import {
  likeRecording, listComments, createComment, deleteComment, likeComment, commentRequestId,
} from '@/services/recordingSocial';
import {
  goEntryDetail, goRecord, ROUTES, pageUrl,
} from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { notify, confirm } from '@/services/feedback';

export default {
  components: {
    PageShell,
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
    CollectionPicker,
  },
  data: () => ({
    id: null,
    recording: null,
    loading: true,
    error: '',
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
    form: {
      body: '',
    },
    rules: {
      body: [{
        required: true,
        message: '先写下想说的话',
      }],
    },
  }),
  computed: {
    recorderName() {
      return this.recording?.recorder?.nickname || this.recording?.recorder?.username || '乡音贡献者';
    },
    shareType() {
      return typeof window === 'undefined' ? 'share' : '';
    },
  },
  onLoad(options) {
    this.id = options.id;
  },
  onShow() {
    this.load();
  },
  onShareAppMessage() {
    return this.shareMessage();
  },
  onShareTimeline() {
    return this.shareMessage();
  },
  methods: {
    entryTitle,
    dialectLabel,
    goEntryDetail,
    recordFor(id) {
      goRecord({
        entry_id: id,
      });
    },
    linkLabel(link) {
      return {
        primary: '主要词条',
        mention: '句中词',
        competing: '另一种解释',
      }[link.role] || '关联词条';
    },
    parentName(id) {
      return this.comments.find((item) => item.id === id)?.author_name || '前面的留言';
    },
    auth() {
      return requireAuth('interact_recording', {
        recordingId: this.id,
      });
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.recording = await getRecording(this.id);
        await this.loadComments();
      } catch (error) {
        this.recording = null;
        this.error = '录音不存在、未公开或暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    async loadComments(more = false) {
      if (this.commentsLoading) return;
      this.commentsLoading = true;
      this.commentsError = '';
      const page = more === true ? this.commentsPage + 1 : 1;
      try {
        const response = await listComments(this.id, page);
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
    async toggleLike() {
      if (this.busy || !this.auth()) return;
      this.busy = true;
      try {
        Object.assign(this.recording, await likeRecording(this.id, !this.recording.liked));
      } catch (error) {
        notify({
          title: '点赞失败，请重试',
        });
      } finally {
        this.busy = false;
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
          recording_id: this.id,
          parent_id: this.reply?.id || null,
          body: this.form.body.trim(),
          client_id: this.requestId,
        });
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
        Object.assign(comment, await likeComment(comment.id, !comment.liked));
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
        await deleteComment(comment.id);
        await this.loadComments();
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    shareMessage() {
      if (!this.recording?.visibility) {
        return {
          title: '乡声集盒',
          path: ROUTES.home,
        };
      }
      return {
        title: `乡声集盒 · ${this.recording.original_gloss}`,
        path: pageUrl(ROUTES.recordingDetail, {
          id: this.id,
        }),
        query: `id=${this.id}`,
      };
    },
    share() {
      // #ifdef H5
      if (typeof window === 'undefined') return;
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const url = `${window.location.origin}${base}${pageUrl(ROUTES.recordingDetail, {
        id: this.id,
      })}`;
      uni.setClipboardData({
        data: url,
        success: () => notify({
          title: '乡音链接已复制',
        }),
        fail: () => notify({
          title: '复制失败，请重试',
        }),
      });
      // #endif
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
