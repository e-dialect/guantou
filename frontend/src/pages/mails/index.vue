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
          hover-class="filter--pressed"
          @tap="setFilter('all')"
        >
          全部
        </button>
        <button
          :class="['filter', { active: filter === 'unread' }]"
          hover-class="filter--pressed"
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
        <button
          class="retry-button"
          hover-class="filter--pressed"
          @tap="refresh"
        >
          重试
        </button>
      </view>
      <view
        v-else-if="!notifications.length"
        class="state"
      >
        <text>{{ filter === 'unread' ? '没有未读消息' : '还没有通知' }}</text>
        <text class="state-copy">
          词条补证、地区确认和审核结果会出现在这里。
        </text>
      </view>
      <view
        v-for="item in notifications"
        :key="item.id"
        :class="['notification-card', { unread: item.unread }]"
        hover-class="notification-card--pressed"
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
              class="status-badge"
              :class="{ unread: item.unread }"
            >
              {{ item.unread ? '未读' : '已读' }}
            </text>
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
  gap: var(--space-2);
  padding: var(--space-2) 28rpx;
  background: var(--surface-subtle-color);
}

.filter {
  width: auto;
  margin: 0;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 62rpx;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.filter.active {
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.filter::after {
  border: 0;
}

.filter--pressed {
  transform: scale(0.98);
  opacity: 0.85;
}

.notification-scroll {
  height: 100%;
}

.notification-card {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.notification-card.unread {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
}

.notification-card--pressed {
  transform: scale(0.99);
  opacity: 0.85;
}

.avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.notification-body {
  min-width: 0;
  flex: 1;
}

.notification-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.title {
  min-width: 0;
  flex: 1;
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 800;
}

.status-badge {
  flex: 0 0 auto;
  padding: 2rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.status-badge.unread {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.actor,
.time {
  margin-top: 6rpx;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.description {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.45;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: 100rpx var(--space-4);
  color: var(--muted-color);
  text-align: center;
}

.state-copy {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.retry-button {
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
  font-size: var(--font-size-xs);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.retry-button::after {
  border: 0;
}

:deep(.notification-content) {
  height: calc(100vh - 154rpx);
  min-height: 0;
  padding: var(--space-2) 28rpx 60rpx;
}

@media (prefers-reduced-motion: reduce) {
  .filter,
  .notification-card,
  .retry-button {
    transition: none;
  }
}
</style>
