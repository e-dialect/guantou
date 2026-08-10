<template>
  <PageShell
    title="全部评论"
    :scroll="false"
    content-class="comments-content"
  >
    <scroll-view
      scroll-y
      class="comments-scroll"
      @scrolltolower="loadMore"
    >
      <view
        v-if="!loading && !comments.length"
        class="empty"
      >
        还没有评论，欢迎留下第一条真实反馈。
      </view>
      <view
        v-for="comment in comments"
        :key="comment.id"
        class="comment-row"
      >
        <image
          class="avatar"
          :src="comment.author.avatar"
          mode="aspectFill"
        />
        <view class="body">
          <view class="head">
            <text class="author">
              {{ comment.author.nickname || comment.author.username }}
            </text>
            <button
              :class="['like', { active: comment.liked_by_me }]"
              @tap="toggleLike(comment)"
            >
              {{ comment.liked_by_me ? '♥' : '♡' }} {{ comment.like_count || 0 }}
            </button>
          </view>
          <view class="content">
            {{ comment.content }}
          </view>
          <view class="time">
            {{ formatTime(comment.created_at) }}
          </view>
        </view>
      </view>
      <uni-load-more :status="loadStatus" />
    </scroll-view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import {
  likeCanComment,
  listCanComments,
  unlikeCanComment,
} from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';

export default {
  components: { PageShell },
  data() {
    return {
      canId: 0,
      comments: [],
      loading: false,
      loadStatus: 'more',
      page: 1,
    };
  },
  async onLoad(options) {
    this.canId = Number(options.id);
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.page = 1;
      this.comments = [];
      this.loadStatus = 'more';
      await this.fetchPage(1);
    },
    async fetchPage(page) {
      if (this.loading || this.loadStatus === 'noMore') return;
      this.loading = true;
      this.loadStatus = 'loading';
      try {
        const response = await listCanComments(this.canId, { page });
        const incoming = response.results || response || [];
        this.comments = this.comments.concat(incoming);
        this.page = page;
        this.loadStatus = response.next ? 'more' : 'noMore';
      } catch (error) {
        this.loadStatus = 'more';
        uni.showToast({ title: error.message || '评论加载失败', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (this.loadStatus === 'more') this.fetchPage(this.page + 1);
    },
    async toggleLike(comment) {
      if (!requireAuth('comment_like', { page: 'can_comments', canId: this.canId })) return;
      const response = comment.liked_by_me
        ? await unlikeCanComment(comment.id)
        : await likeCanComment(comment.id);
      this.comments = this.comments.map((item) => (item.id === comment.id
        ? { ...item, liked_by_me: response.liked, like_count: response.like_count }
        : item));
    },
    formatTime(value) {
      return String(value || '').replace('T', ' ').slice(0, 16);
    },
  },
};
</script>

<style scoped>
.comments-scroll {
  height: 100%;
}

.empty {
  padding: 80rpx 20rpx;
  color: #79857d;
  text-align: center;
}

.comment-row {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 0;
  border-bottom: 1px solid #edf0eb;
}

.avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #e5eae2;
}

.body {
  min-width: 0;
  flex: 1;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.author {
  font-size: 25rpx;
  font-weight: 800;
}

.like {
  margin: 0;
  padding: 0 14rpx;
  background: transparent;
  color: #728078;
  font-size: 23rpx;
  line-height: 44rpx;
}

.like.active {
  color: #9a3f31;
}

.like::after {
  border: 0;
}

.content {
  margin-top: 8rpx;
  color: #34463b;
  font-size: 27rpx;
  line-height: 1.55;
  white-space: pre-wrap;
}

.time {
  margin-top: 8rpx;
  color: #8a948d;
  font-size: 21rpx;
}

:deep(.comments-content) {
  height: calc(100vh - 100rpx);
  min-height: 0;
  padding: 0 28rpx 60rpx;
}
</style>
