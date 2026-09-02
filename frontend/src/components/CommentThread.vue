<template>
  <view class="comment-thread">
    <view class="comment-thread__rule">
      讨论观点，也尊重每一种真实使用。
    </view>

    <BaseLoading
      v-if="loading && !comments.length"
      text="正在翻阅评论"
    />
    <view
      v-else-if="errorMessage && !comments.length"
      class="comment-thread__error"
    >
      <text class="comment-thread__error-text">
        {{ errorMessage }}
      </text>
      <BaseButton
        class="comment-thread__retry"
        variant="ghost"
        size="small"
        text="重试"
        @click="retry"
      />
    </view>
    <EmptyState
      v-else-if="!comments.length"
      title="还没有评论，来留下第一条依据"
    />
    <view v-else>
      <view
        v-for="comment in comments"
        :key="comment.id"
        class="comment-block"
      >
        <view class="comment-row">
          <image
            v-if="comment.author.avatar"
            class="comment-row__avatar"
            :src="comment.author.avatar"
            mode="aspectFill"
          />
          <view
            v-else
            class="comment-row__avatar comment-row__avatar--empty"
          />
          <view class="comment-row__body">
            <view class="comment-row__head">
              <text class="comment-row__author">
                {{ comment.author.nickname || comment.author.username }}
              </text>
              <text class="comment-row__time">
                {{ formatTime(comment.created_at) }}
              </text>
            </view>
            <view class="comment-row__content">
              {{ comment.content }}
            </view>
            <view class="comment-row__actions">
              <text
                :class="{ 'comment-row__liked': comment.liked_by_me }"
                @tap="toggleLike(comment)"
              >
                {{ comment.liked_by_me ? '已赞' : '赞' }} {{ comment.like_count || 0 }}
              </text>
              <text @tap="startReply(comment)">
                回复
              </text>
              <text
                v-if="canDelete(comment)"
                @tap="remove(comment)"
              >
                删除
              </text>
            </view>
          </view>
        </view>

        <!-- 二级回复区：按一级评论折叠/展开，回复保持二层平铺 -->
        <view
          v-if="replyCount(comment)"
          class="comment-block__toggle"
          @tap="toggleReplies(comment)"
        >
          {{ comment.expanded ? '收起回复' : `查看 ${replyCount(comment)} 条回复` }}
        </view>

        <view
          v-if="comment.expanded"
          class="comment-replies"
        >
          <view
            v-for="reply in comment.replies"
            :key="reply.id"
            class="comment-reply"
          >
            <image
              v-if="reply.author.avatar"
              class="comment-reply__avatar"
              :src="reply.author.avatar"
              mode="aspectFill"
            />
            <view
              v-else
              class="comment-reply__avatar comment-reply__avatar--empty"
            />
            <view class="comment-reply__body">
              <view class="comment-reply__head">
                <text class="comment-reply__author">
                  {{ reply.author.nickname || reply.author.username }}
                </text>
                <text class="comment-reply__time">
                  {{ formatTime(reply.created_at) }}
                </text>
              </view>
              <view class="comment-reply__content">
                <text
                  v-if="reply.reply_to"
                  class="comment-reply__at"
                >
                  回复 @{{ reply.reply_to.nickname || reply.reply_to.username }}：
                </text>
                {{ reply.content }}
              </view>
              <view class="comment-reply__actions">
                <text
                  :class="{ 'comment-row__liked': reply.liked_by_me }"
                  @tap="toggleLike(reply)"
                >
                  {{ reply.liked_by_me ? '已赞' : '赞' }} {{ reply.like_count || 0 }}
                </text>
                <text @tap="startReply(reply)">
                  回复
                </text>
                <text
                  v-if="canDelete(reply)"
                  @tap="remove(reply)"
                >
                  删除
                </text>
              </view>
            </view>
          </view>
          <BaseButton
            v-if="comment.repliesHasMore"
            block
            variant="ghost"
            size="small"
            text="展开更多回复"
            :loading="comment.repliesLoading"
            @click="loadReplies(comment)"
          />
        </view>
      </view>
      <BaseButton
        v-if="hasMore"
        block
        variant="ghost"
        text="加载更多"
        :loading="loading"
        @click="loadMore"
      />
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  createCanComment,
  createNameplateComment,
  deleteCanComment,
  likeCanComment,
  listCanComments,
  listCommentReplies,
  listNameplateComments,
  replyToComment,
  unlikeCanComment,
} from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';

export default {
  name: 'CommentThread',
  components: {
    BaseButton,
    BaseLoading,
    EmptyState,
  },
  props: {
    targetType: {
      type: String,
      required: true,
      validator: (value) => ['can', 'nameplate'].includes(value),
    },
    targetId: {
      type: [Number, String],
      required: true,
    },
  },
  emits: ['created', 'reply'],
  data() {
    return {
      comments: [],
      page: 0,
      hasMore: true,
      loading: false,
      errorMessage: '',
    };
  },
  mounted() {
    this.loadMore();
  },
  methods: {
    authContext() {
      return this.targetType === 'nameplate'
        ? { page: 'nameplate_comments', nameplateId: this.targetId }
        : { page: 'can_comments', canId: this.targetId };
    },
    normalizeComment(item) {
      return {
        ...item,
        expanded: false,
        replies: [],
        repliesLoaded: false,
        repliesLoading: false,
        repliesHasMore: true,
        replyPage: 0,
      };
    },
    replyCount(comment) {
      return Number(comment.reply_count || 0);
    },
    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      this.errorMessage = '';
      try {
        const nextPage = this.page + 1;
        const response = this.targetType === 'nameplate'
          ? await listNameplateComments(this.targetId, { page: nextPage })
          : await listCanComments(this.targetId, { page: nextPage });
        const items = response.results || response || [];
        this.comments = this.comments.concat(items.map((item) => this.normalizeComment(item)));
        this.page = nextPage;
        this.hasMore = Boolean(response.next);
      } catch (error) {
        this.errorMessage = error.message || '评论加载失败';
        uni.showToast({ title: error.message || '评论加载失败', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    async retry() {
      await this.loadMore();
    },
    /*
     * 顶层评论的输入框已上移到 CommentSheet 底部（问题 2），此处只保留提交逻辑：
     * 由外部（CommentSheet）传入正文，校验/鉴权/创建/前置后返回新评论；
     * 返回 null 表示未提交（空内容或被鉴权拦截），供调用方决定是否清空草稿。
     */
    async submitComment(content) {
      const trimmed = String(content || '').trim();
      if (!trimmed) {
        uni.showToast({ title: '先写下评论', icon: 'none' });
        return null;
      }
      const action = this.targetType === 'nameplate' ? 'nameplate_comment' : 'comment';
      if (!requireAuth(action, this.authContext())) return null;
      const comment = this.targetType === 'nameplate'
        ? await createNameplateComment(this.targetId, trimmed)
        : await createCanComment(this.targetId, trimmed);
      this.comments = [this.normalizeComment(comment), ...this.comments];
      this.$emit('created', comment);
      return comment;
    },
    updateComment(commentId, updater) {
      this.comments = this.comments.map((item) => {
        if (item.id === commentId) return updater(item);
        if (item.replies.some((reply) => reply.id === commentId)) {
          return {
            ...item,
            replies: item.replies.map((reply) => (
              reply.id === commentId ? updater(reply) : reply
            )),
          };
        }
        return item;
      });
    },
    toggleReplies(comment) {
      const willExpand = !comment.expanded;
      this.updateComment(comment.id, (item) => ({ ...item, expanded: willExpand }));
      if (willExpand && !comment.repliesLoaded) {
        this.loadReplies(comment);
      }
    },
    async loadReplies(comment) {
      if (comment.repliesLoading || !comment.repliesHasMore) return;
      this.updateComment(comment.id, (item) => ({ ...item, repliesLoading: true }));
      try {
        const nextPage = comment.replyPage + 1;
        const response = await listCommentReplies(comment.id, { page: nextPage });
        const items = response.results || response || [];
        this.updateComment(comment.id, (item) => ({
          ...item,
          replies: item.replies.concat(items),
          replyPage: nextPage,
          repliesHasMore: Boolean(response.next),
          // 仅加载成功后标记已加载；失败保持 false，折叠再展开即可重试（#254）。
          repliesLoaded: true,
          repliesLoading: false,
        }));
      } catch (error) {
        // 失败只清 loading：已加载的回复保留、repliesHasMore 不变，分页失败可直接再点重试。
        this.updateComment(comment.id, (item) => ({ ...item, repliesLoading: false }));
        uni.showToast({ title: error.message || '回复加载失败', icon: 'none' });
      }
    },
    startReply(item) {
      const isReply = Boolean(item.parent_id);
      // 回复意图上抛给 CommentSheet，由其底部输入框承接（问题 2）
      this.$emit('reply', {
        parentId: isReply ? item.parent_id : item.id,
        replyToId: item.id,
        nickname: item.author?.nickname || item.author?.username || '',
      });
    },
    /*
     * 回复提交：由 CommentSheet 底部输入框调用。校验/鉴权/创建后挂到所属一级评论，
     * 返回新回复；返回 null 表示未提交（空内容或被鉴权拦截）。
     */
    async submitReply({ replyToId, parentId, content }) {
      const trimmed = String(content || '').trim();
      if (!trimmed) {
        uni.showToast({ title: '先写下回复', icon: 'none' });
        return null;
      }
      const action = this.targetType === 'nameplate' ? 'nameplate_comment' : 'comment';
      if (!requireAuth(action, this.authContext())) return null;
      const reply = await replyToComment(replyToId, trimmed);
      const parent = this.comments.find((item) => item.id === parentId);
      if (parent) {
        parent.replies = parent.replies.concat(reply);
        parent.reply_count = Number(parent.reply_count || 0) + 1;
      }
      this.$emit('created', reply);
      return reply;
    },
    async toggleLike(comment) {
      const action = this.targetType === 'nameplate' ? 'nameplate_comment' : 'comment_like';
      if (!requireAuth(action, this.authContext())) return;
      const result = comment.liked_by_me
        ? await unlikeCanComment(comment.id)
        : await likeCanComment(comment.id);
      this.updateComment(comment.id, (item) => ({
        ...item,
        liked_by_me: result.liked,
        like_count: result.like_count,
      }));
    },
    async remove(comment) {
      await deleteCanComment(comment.id);
      if (comment.parent_id) {
        const parent = this.comments.find((item) => item.id === comment.parent_id);
        if (parent) {
          parent.replies = parent.replies.filter((item) => item.id !== comment.id);
          parent.reply_count = Math.max(0, Number(parent.reply_count || 0) - 1);
        }
      } else {
        this.comments = this.comments.filter((item) => item.id !== comment.id);
      }
    },
    canDelete(comment) {
      return Number(comment.author?.id) === Number(uni.getStorageSync('id'));
    },
    formatTime(value) {
      return String(value || '').replace('T', ' ').slice(0, 16);
    },
  },
};
</script>

<style scoped>
.comment-thread__rule {
  padding: 28rpx 4rpx 14rpx;
  color: var(--muted-color);
  font-size: 22rpx;
  letter-spacing: 1rpx;
}

.comment-thread__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.comment-thread__error-text {
  min-width: 0;
  flex: 1;
  color: var(--danger-color);
  font-size: var(--font-size-sm);
}

.comment-thread__retry {
  flex: 0 0 auto;
  margin: 0;
}

.comment-block {
  border-bottom: 1rpx solid var(--border-color);
}

.comment-row {
  display: flex;
  gap: 18rpx;
  padding: 26rpx 0;
}

.comment-row__avatar {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.comment-row__body {
  min-width: 0;
  flex: 1;
}

.comment-row__head,
.comment-row__actions {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
}

.comment-row__author {
  color: var(--text-color);
  font-size: 24rpx;
  font-weight: 800;
}

.comment-row__time,
.comment-row__actions {
  color: var(--muted-color);
  font-size: 20rpx;
}

.comment-row__content {
  margin-top: 10rpx;
  color: var(--text-color);
  font-size: 27rpx;
  line-height: 1.6;
  white-space: pre-wrap;
}

.comment-row__actions {
  justify-content: flex-start;
  margin-top: 14rpx;
}

.comment-row__liked {
  color: var(--accent-color);
  font-weight: 800;
}

.comment-block__toggle {
  margin: 0 0 20rpx 76rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.comment-replies {
  margin: 0 0 8rpx 76rpx;
  padding: 8rpx 0;
  background: var(--surface-subtle-color);
  border-radius: var(--radius-sm);
}

.comment-reply {
  display: flex;
  gap: 16rpx;
  padding: 20rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.comment-reply:last-child {
  border-bottom: 0;
}

.comment-reply__avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--surface-color);
  flex: 0 0 auto;
}

.comment-reply__body {
  min-width: 0;
  flex: 1;
}

.comment-reply__head {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
}

.comment-reply__author {
  color: var(--text-secondary-color);
  font-size: 23rpx;
  font-weight: 800;
}

.comment-reply__time {
  color: var(--muted-color);
  font-size: 19rpx;
}

.comment-reply__content {
  margin-top: 8rpx;
  color: var(--text-color);
  font-size: 25rpx;
  line-height: 1.6;
  white-space: pre-wrap;
}

.comment-reply__at {
  color: var(--accent-color);
}

.comment-reply__actions {
  display: flex;
  justify-content: flex-start;
  gap: 24rpx;
  margin-top: 12rpx;
  color: var(--muted-color);
  font-size: 20rpx;
}

</style>
