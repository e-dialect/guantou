<template>
  <view class="social-feeds">
    <view class="feed-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['feed-tab', { active: activeFeed === tab.key }]"
        @tap="activate(tab.key)"
      >
        {{ tab.label }}
      </button>
    </view>
    <view
      v-for="(tab, index) in tabs"
      v-show="activeFeed === tab.key"
      :key="tab.key"
      class="feed-pane"
    >
      <CanList
        ref="feedLists"
        :auto-load="false"
        :fetcher="fetcher"
        :query="tab.query"
        :empty-title="tab.emptyTitle"
        :empty-description="tab.emptyDescription"
        social
        @author="$emit('author', $event)"
        @comment="$emit('comment', $event)"
        @open="$emit('open', $event)"
        @share="$emit('share', $event)"
        @loaded="markLoaded(index)"
      />
    </view>
  </view>
</template>

<script>
import CanList from './CanList.vue';

export default {
  name: 'SocialCanFeeds',
  components: { CanList },
  props: {
    fetcher: {
      type: Function,
      required: true,
    },
  },
  emits: ['author', 'comment', 'open', 'share'],
  data() {
    return {
      activeFeed: 'dialect',
      loaded: {},
      tabs: [
        {
          key: 'dialect',
          query: { feed: 'dialect' },
          label: '同方言',
          emptyTitle: '还没有同方言罐头',
          emptyDescription: '主方言及其下级方言暂无公开录音。',
        },
        {
          key: 'following',
          query: { feed: 'following' },
          label: '关注',
          emptyTitle: '关注流还是空的',
          emptyDescription: '关注方言或真实作者后，他们的公开罐头会出现在这里。',
        },
        {
          key: 'recommended',
          query: { feed: 'recommended' },
          label: '推荐',
          emptyTitle: '暂时没有推荐',
          emptyDescription: '公开罐头增加后，这里会优先展示与你方言相关的内容。',
        },
      ],
    };
  },
  mounted() {
    this.$nextTick(() => this.loadActive());
  },
  methods: {
    activate(key) {
      this.activeFeed = key;
      this.$nextTick(() => this.loadActive());
    },
    activeIndex() {
      return this.tabs.findIndex((tab) => tab.key === this.activeFeed);
    },
    feedList(index) {
      const refs = this.$refs.feedLists || [];
      return Array.isArray(refs) ? refs[index] : refs;
    },
    loadActive() {
      const index = this.activeIndex();
      if (index < 0 || this.loaded[this.activeFeed]) return;
      const list = this.feedList(index);
      if (list) list.refresh();
    },
    markLoaded(index) {
      const tab = this.tabs[index];
      if (tab) this.loaded = { ...this.loaded, [tab.key]: true };
    },
  },
};
</script>

<style scoped>
.social-feeds {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  margin-top: 24rpx;
}

.feed-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 7rpx;
  border: 1px solid #dce3d8;
  border-radius: 999rpx;
  background: #edf1ea;
}

.feed-tab {
  margin: 0;
  border-radius: 999rpx;
  background: transparent;
  color: #657168;
  font-size: 25rpx;
  line-height: 60rpx;
}

.feed-tab.active {
  background: #fff;
  color: #1f5c43;
  font-weight: 800;
  box-shadow: 0 3rpx 12rpx rgb(40 75 57 / 10%);
}

.feed-tab::after {
  border: 0;
}

.feed-pane {
  min-height: 0;
  flex: 1;
  padding-top: 20rpx;
}
</style>
