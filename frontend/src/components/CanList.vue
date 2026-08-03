<template>
  <scroll-view
    v-if="scroll"
    scroll-y
    class="can-list scroll-list"
    @scrolltolower="loadMore"
  >
    <view class="can-list-inner">
      <CanCard
        v-for="item in items"
        :key="item.id"
        :can="item"
        @open="$emit('open', $event)"
      />
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
      @open="$emit('open', $event)"
    />
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
  emits: ['open', 'loaded', 'empty-action', 'error'],
  data() {
    return {
      items: [],
      page: 1,
      loadingStatus: 'more',
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
    async refresh() {
      this.page = 1;
      this.loadingStatus = 'loading';
      try {
        const response = await this.fetcher({ ...this.query, page: this.page });
        this.items = this.normalizedItems(response);
        this.loadingStatus = response.next && !this.maxItems ? 'more' : 'noMore';
        this.$emit('loaded', this.items);
      } catch (error) {
        this.loadingStatus = 'more';
        this.$emit('error', error);
      }
    },
    async loadMore() {
      if (this.loadingStatus !== 'more' || this.maxItems) return;
      this.page += 1;
      this.loadingStatus = 'loading';
      try {
        const response = await this.fetcher({ ...this.query, page: this.page });
        this.items = this.items.concat(this.normalizedItems(response));
        this.loadingStatus = response.next ? 'more' : 'noMore';
        this.$emit('loaded', this.items);
      } catch (error) {
        this.page -= 1;
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
</style>
