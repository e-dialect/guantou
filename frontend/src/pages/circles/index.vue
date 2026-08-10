<template>
  <PageShell title="方言圈广场">
    <view class="search-row">
      <input
        v-model="search"
        class="search"
        placeholder="搜索方言圈"
        @confirm="refresh"
      >
      <button
        class="search-button"
        @tap="refresh"
      >
        搜索
      </button>
    </view>
    <view
      v-if="loading"
      class="state"
    >
      正在加载方言圈…
    </view>
    <view
      v-else-if="error"
      class="state error"
      @tap="refresh"
    >
      {{ error }}，点此重试
    </view>
    <template v-else>
      <view
        v-for="circle in circles"
        :key="circle.id"
        class="circle-card"
        @tap="toDetail(circle.id)"
      >
        <view class="circle-copy">
          <view class="circle-title">
            {{ circle.name }}
          </view>
          <view class="circle-description">
            {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
          </view>
          <view class="circle-meta">
            {{ circle.member_count }} 位成员 · {{ circle.can_count }} 个公开罐头
          </view>
        </view>
        <button
          :class="['join-button', { joined: circle.is_member }]"
          @tap.stop="toggleMembership(circle)"
        >
          {{ circle.is_member ? '已加入' : '加入' }}
        </button>
      </view>
      <EmptyState
        v-if="!circles.length"
        title="还没有匹配的方言圈"
        description="可以换个关键词，或先去图鉴和公开罐头逛逛。"
        action-text="去发现"
        @action="toDiscovery"
      />
    </template>
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import {
  joinCircle, leaveCircle, listCircles,
} from '@/services/guantou';

export default {
  components: { EmptyState, PageShell },
  data() {
    return {
      circles: [], error: '', loading: false, search: '',
    };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      this.error = '';
      try {
        const response = await listCircles({ search: this.search.trim() });
        this.circles = response.results || response || [];
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      } finally {
        this.loading = false;
      }
    },
    async toggleMembership(circle) {
      if (!requireAuth('circle_join', { page: 'circle_index', circleId: circle.id })) return;
      const result = circle.is_member
        ? await leaveCircle(circle.id)
        : await joinCircle(circle.id);
      this.circles = this.circles.map((item) => (item.id === circle.id
        ? { ...item, ...result }
        : item));
    },
    toDetail(id) {
      uni.navigateTo({ url: `/pages/circles/details?id=${id}` });
    },
    toDiscovery() {
      uni.navigateTo({ url: '/pages/discovery/index' });
    },
  },
};
</script>

<style scoped>
.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14rpx;
  margin-bottom: 24rpx;
}
.search {
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
  background: #fff;
}
.search-button {
  margin: 0;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 26rpx;
}
.circle-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 18rpx;
  padding: 24rpx;
  border: 1px solid #e1e6dc;
  border-radius: 16rpx;
  background: #fff;
}
.circle-copy { min-width: 0; flex: 1; }
.circle-title { color: #1d2a24; font-size: 34rpx; font-weight: 800; }
.circle-description { margin-top: 10rpx; color: #4d5c53; line-height: 1.5; }
.circle-meta { margin-top: 12rpx; color: #7a867d; font-size: 24rpx; }
.join-button {
  width: auto;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 25rpx;
}
.join-button.joined { background: #e7eee7; color: #526258; }
.join-button::after { border: 0; }
.state { padding: 70rpx 20rpx; color: #6a766e; text-align: center; }
.state.error { color: #9b3a2d; }
</style>
