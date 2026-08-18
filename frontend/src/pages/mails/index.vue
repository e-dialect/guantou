<template>
  <PageShell
    title="通知中心"
    :scroll="false"
    content-class="notification-content"
    action-text="全部已读"
    @action="markAllRead"
  >
    <template #before>
      <view class="filters">
        <button
          :class="['filter', { active: filter === 'all' }]"
          @tap="setFilter('all')"
        >
          全部
        </button>
        <button
          :class="['filter', { active: filter === 'unread' }]"
          @tap="setFilter('unread')"
        >
          未读
        </button>
      </view>
    </template>

    <scroll-view
      scroll-y
      class="notification-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refresh"
      @scrolltolower="loadMore"
    >
      <view
        v-if="loading && !notifications.length"
        class="state"
      >
        正在加载通知…
      </view>
      <view
        v-else-if="error && !notifications.length"
        class="state error"
      >
        <text>{{ error }}</text>
        <button @tap="refresh">
          重试
        </button>
      </view>
      <view
        v-else-if="!notifications.length"
        class="state"
      >
        <text>{{ filter === 'unread' ? '没有未读消息' : '还没有通知' }}</text>
        <text class="state-copy">
          铭牌支持、评论互动和审核结果会出现在这里。
        </text>
      </view>
      <view
        v-for="item in notifications"
        :key="item.id"
        :class="['notification-card', { unread: item.unread }]"
        @tap="openNotification(item)"
      >
        <image
          :src="item.from.avatar"
          class="avatar"
          mode="aspectFill"
        />
        <view class="notification-body">
          <view class="notification-head">
            <text class="title">
              {{ item.title }}
            </text>
            <text
              v-if="item.unread"
              class="unread-dot"
            />
          </view>
          <view class="actor">
            {{ item.from.nickname }}
          </view>
          <view
            v-if="item.content"
            class="description"
          >
            {{ item.content }}
          </view>
          <view class="time">
            {{ item.time }}
          </view>
        </view>
      </view>
      <uni-load-more
        v-if="notifications.length"
        :status="loadStatus"
      />
    </scroll-view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import { openPage } from '@/services/navigation';
import { toMailDetailsPage } from '@/routers/mail';
import { listNotifications, markNotificationsRead } from '@/services/mail';

export default {
  components: { PageShell },
  data() {
    return {
      error: '',
      filter: 'all',
      loadStatus: 'more',
      loading: false,
      notifications: [],
      page: 1,
      refreshing: false,
    };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    setFilter(filter) {
      if (this.filter === filter) return;
      this.filter = filter;
      this.refresh();
    },
    async refresh() {
      this.page = 1;
      this.notifications = [];
      this.error = '';
      this.loadStatus = 'more';
      this.refreshing = true;
      await this.fetchPage(1);
      this.refreshing = false;
    },
    async fetchPage(page) {
      if (this.loading || this.loadStatus === 'noMore') return;
      this.loading = true;
      this.loadStatus = 'loading';
      try {
        const response = await listNotifications({
          page,
          pageSize: 20,
          ...(this.filter === 'unread' ? { unread: true } : {}),
        });
        this.notifications = this.notifications.concat(response.notifications || []);
        this.page = page;
        this.loadStatus = page < response.pages ? 'more' : 'noMore';
      } catch (error) {
        this.error = error.message || '通知加载失败';
        this.loadStatus = 'more';
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (this.loadStatus === 'more') this.fetchPage(this.page + 1);
    },
    async markAllRead() {
      await markNotificationsRead();
      this.notifications = this.notifications.map((item) => ({ ...item, unread: false }));
      if (this.filter === 'unread') this.notifications = [];
      uni.showToast({ title: '已全部标为已读', icon: 'success' });
    },
    async openNotification(item) {
      if (item.unread) {
        await markNotificationsRead([item.id]);
        this.notifications = this.notifications.map((existing) => (existing.id === item.id
          ? { ...existing, unread: false }
          : existing));
      }
      if (item.target?.url) {
        openPage(item.target.url);
        return;
      }
      toMailDetailsPage(item.id);
    },
  },
};
</script>

<style scoped>
.filters {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 28rpx;
  background: #f6f7f3;
}

.filter {
  width: auto;
  margin: 0;
  padding: 0 30rpx;
  border-radius: 999rpx;
  background: #e8ece5;
  color: #617067;
  font-size: 25rpx;
  line-height: 62rpx;
}

.filter.active {
  background: #1f5c43;
  color: #ffffff;
}

.filter::after {
  border: 0;
}

.notification-scroll {
  height: 100%;
}

.notification-card {
  display: flex;
  gap: 18rpx;
  margin-bottom: 16rpx;
  padding: 24rpx;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  background: #ffffff;
}

.notification-card.unread {
  border-color: #b9cfba;
  background: #f4f9f1;
}

.avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: #e5eae2;
}

.notification-body {
  min-width: 0;
  flex: 1;
}

.notification-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.title {
  font-size: 29rpx;
  font-weight: 800;
}

.unread-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #b04432;
}

.actor,
.time {
  margin-top: 6rpx;
  color: #7a867d;
  font-size: 22rpx;
}

.description {
  margin-top: 10rpx;
  color: #405148;
  font-size: 25rpx;
  line-height: 1.45;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 100rpx 30rpx;
  color: #728078;
  text-align: center;
}

.state-copy {
  color: #929c95;
  font-size: 24rpx;
}

.state.error button {
  border-radius: 999rpx;
  background: #1f5c43;
  color: #ffffff;
  font-size: 24rpx;
}

:deep(.notification-content) {
  height: calc(100vh - 154rpx);
  min-height: 0;
  padding: 18rpx 28rpx 60rpx;
}
</style>
