<template>
  <scroll-view
    v-if="scroll"
    scroll-y
    class="can-list scroll-list"
    refresher-enabled
    :refresher-triggered="refresherTriggered"
    @scrolltolower="loadMore"
    @refresherrefresh="refresh"
  >
    <view class="can-list-inner">
      <CanCard
        v-for="item in items"
        :key="item.id"
        :can="item"
        :social="social"
        @author="$emit('author', $event)"
        @comment="$emit('comment', $event)"
        @open="$emit('open', $event)"
        @share="$emit('share', $event)"
      />
      <view
        v-if="initialLoading"
        class="skeleton-list"
      >
        <view
          v-for="index in 3"
          :key="index"
          class="skeleton-card"
        />
      </view>
      <view
        v-if="errorMessage"
        class="load-error"
      >
        <text>{{ errorMessage }}</text>
        <button @tap="refresh">
          重试
        </button>
      </view>
      <EmptyState
        v-if="showEmpty"
        :title="emptyTitle"
        :description="emptyDescription"
        :action-text="emptyActionText"
        @action="$emit('empty-action')"
      />
      <uni-load-more
        v-if="showLoadMore"
        :status="loadingStatus"
      />
    </view>
  </scroll-view>
  <view
    v-else
    class="can-list"
  >
    <CanCard
      v-for="item in items"
      :key="item.id"
      :can="item"
      :social="social"
      @author="$emit('author', $event)"
      @comment="$emit('comment', $event)"
      @open="$emit('open', $event)"
      @share="$emit('share', $event)"
    />
    <view
      v-if="initialLoading"
      class="skeleton-list"
    >
      <view
        v-for="index in 3"
        :key="index"
        class="skeleton-card"
      />
    </view>
    <view
      v-if="errorMessage"
      class="load-error"
    >
      <text>{{ errorMessage }}</text>
      <button @tap="refresh">
        重试
      </button>
    </view>
    <EmptyState
      v-if="showEmpty"
      :title="emptyTitle"
      :description="emptyDescription"
      :action-text="emptyActionText"
      @action="$emit('empty-action')"
    />
    <uni-load-more
      v-if="showLoadMore"
      :status="loadingStatus"
    />
  </view>
</template>

<script>
import CanCard from './CanCard.vue';
import EmptyState from './EmptyState.vue';

export default {
  name: 'CanList',
  components: {
    CanCard,
    EmptyState,
  },
  props: {
    fetcher: {
      type: Function,
      required: true,
    },
    query: {
      type: Object,
      default: () => ({}),
    },
    autoLoad: {
      type: Boolean,
      default: true,
    },
    scroll: {
      type: Boolean,
      default: true,
    },
    showLoadMore: {
      type: Boolean,
      default: true,
    },
    maxItems: {
      type: Number,
      default: 0,
    },
    social: {
      type: Boolean,
      default: false,
    },
    emptyTitle: {
      type: String,
      default: '还没有罐头',
    },
    emptyDescription: {
      type: String,
      default: '',
    },
    emptyActionText: {
      type: String,
      default: '',
    },
  },
  emits: ['author', 'comment', 'open', 'share', 'loaded', 'empty-action', 'error'],
  data() {
    return {
      items: [],
      errorMessage: '',
      initialLoading: false,
      page: 1,
      loadingStatus: 'more',
      refresherTriggered: false,
    };
  },
  computed: {
    showEmpty() {
      return this.loadingStatus === 'noMore' && !this.items.length;
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.refresh();
      },
    },
  },
  mounted() {
    if (this.autoLoad) this.refresh();
  },
  methods: {
    normalizedItems(response) {
      const items = response.results || response || [];
      return this.maxItems ? items.slice(0, this.maxItems) : items;
    },
    uniqueItems(items) {
      const seen = new Set();
      return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    },
    async refresh() {
      this.page = 1;
      this.errorMessage = '';
      this.initialLoading = !this.items.length;
      this.refresherTriggered = Boolean(this.items.length);
      const previousStatus = this.loadingStatus;
      this.loadingStatus = 'loading';
      try {
        const response = await this.fetcher({ ...this.query, page: this.page });
        this.items = this.uniqueItems(this.normalizedItems(response));
        this.loadingStatus = response.next && !this.maxItems ? 'more' : 'noMore';
        this.$emit('loaded', this.items);
      } catch (error) {
        this.errorMessage = '加载失败，点此重试';
        this.loadingStatus = this.items.length ? previousStatus : 'more';
        this.$emit('error', error);
      } finally {
        this.initialLoading = false;
        this.refresherTriggered = false;
      }
    },
    async loadMore() {
      if (this.loadingStatus !== 'more' || this.maxItems) return;
      const nextPage = this.page + 1;
      this.errorMessage = '';
      this.loadingStatus = 'loading';
      try {
        const response = await this.fetcher({ ...this.query, page: nextPage });
        this.page = nextPage;
        this.items = this.uniqueItems(this.items.concat(this.normalizedItems(response)));
        this.loadingStatus = response.next ? 'more' : 'noMore';
        this.$emit('loaded', this.items);
      } catch (error) {
        this.errorMessage = '加载更多失败，点此重试';
        this.loadingStatus = 'more';
        this.$emit('error', error);
      }
    },
  },
};
</script>

<style scoped>
.can-list {
  box-sizing: border-box;
}

.scroll-list {
  height: 100%;
}

.can-list-inner {
  padding-bottom: 60rpx;
}

.skeleton-card {
  height: 250rpx;
  margin-bottom: 18rpx;
  border-radius: 12rpx;
  background: linear-gradient(90deg, #e9ede6 25%, #f4f6f2 50%, #e9ede6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 18rpx 22rpx;
  border-radius: 10rpx;
  background: #f8ece8;
  color: #8b4438;
  font-size: 24rpx;
}

.load-error button {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 22rpx;
  background: #fff;
  color: #8b4438;
  font-size: 23rpx;
  line-height: 52rpx;
}

.load-error button::after {
  border: 0;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
