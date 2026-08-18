<template>
  <view class="comment-thread">
    <view class="comment-thread__composer">
      <t-textarea
        v-model:value="draft"
        :maxlength="500"
        placeholder="说说你的依据、读法或补充……"
        indicator
        autosize
      />
      <t-button
        block
        theme="primary"
        :loading="submitting"
        @click="submit"
      >
        发表评论
      </t-button>
    </view>

    <view class="comment-thread__rule">
      讨论观点，也尊重每一种真实使用。
    </view>

    <t-loading
      v-if="loading && !comments.length"
      text="正在翻阅评论"
    />
    <t-empty
      v-else-if="!comments.length"
      description="还没有评论，来留下第一条依据"
    />
    <view v-else>
      <view
        v-for="comment in comments"
        :key="comment.id"
        class="comment-row"
      >
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
            <text
              v-if="canDelete(comment)"
              @tap="remove(comment)"
            >
              删除
            </text>
          </view>
        </view>
      </view>
      <t-button
        v-if="hasMore"
        block
        variant="text"
        :loading="loading"
        @click="loadMore"
      >
        加载更多
      </t-button>
    </view>
  </view>
</template>

<script>
import TButton from '@tdesign/uniapp/button/button.vue';
import TEmpty from '@tdesign/uniapp/empty/empty.vue';
import TLoading from '@tdesign/uniapp/loading/loading.vue';
import TTextarea from '@tdesign/uniapp/textarea/textarea.vue';
import {
  createCanComment,
  createNameplateComment,
  deleteCanComment,
  likeCanComment,
  listCanComments,
  listNameplateComments,
  unlikeCanComment,
} from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';

export default {
  name: 'CommentThread',
  components: {
    TButton,
    TEmpty,
    TLoading,
    TTextarea,
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
  data() {
    return {
      draft: '',
      comments: [],
      page: 0,
      hasMore: true,
      loading: false,
      submitting: false,
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
    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      try {
        const nextPage = this.page + 1;
        const response = this.targetType === 'nameplate'
          ? await listNameplateComments(this.targetId, { page: nextPage })
          : await listCanComments(this.targetId, { page: nextPage });
        const items = response.results || response || [];
        this.comments = this.comments.concat(items);
        this.page = nextPage;
        this.hasMore = Boolean(response.next);
      } catch (error) {
        uni.showToast({ title: error.message || '评论加载失败', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    async submit() {
      const content = String(this.draft || '').trim();
      if (!content) {
        uni.showToast({ title: '先写下评论', icon: 'none' });
        return;
      }
      const action = this.targetType === 'nameplate' ? 'nameplate_comment' : 'comment';
      if (!requireAuth(action, this.authContext())) return;
      this.submitting = true;
      try {
        const comment = this.targetType === 'nameplate'
          ? await createNameplateComment(this.targetId, content)
          : await createCanComment(this.targetId, content);
        this.comments = [comment, ...this.comments];
        this.draft = '';
        this.$emit('created', comment);
      } finally {
        this.submitting = false;
      }
    },
    async toggleLike(comment) {
      const action = this.targetType === 'nameplate' ? 'nameplate_comment' : 'comment_like';
      if (!requireAuth(action, this.authContext())) return;
      const result = comment.liked_by_me
        ? await unlikeCanComment(comment.id)
        : await likeCanComment(comment.id);
      this.comments = this.comments.map((item) => (item.id === comment.id
        ? { ...item, liked_by_me: result.liked, like_count: result.like_count }
        : item));
    },
    async remove(comment) {
      await deleteCanComment(comment.id);
      this.comments = this.comments.filter((item) => item.id !== comment.id);
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
.comment-thread__composer {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 24rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.comment-thread__rule {
  padding: 28rpx 4rpx 14rpx;
  color: var(--muted-text-color);
  font-size: 22rpx;
  letter-spacing: 1rpx;
}

.comment-row {
  display: flex;
  gap: 18rpx;
  padding: 26rpx 0;
  border-bottom: 1rpx solid var(--border-color);
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
  color: var(--muted-text-color);
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
</style>
