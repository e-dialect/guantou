<template>
  <PageShell
    title="发现乡音"
    action-text="方言圈"
    @action="toCircles"
  >
    <view
      v-if="loading"
      class="state"
    >
      正在发现乡音…
    </view>
    <view
      v-else-if="error"
      class="state error"
      @tap="load"
    >
      {{ error }}，点此重试
    </view>
    <template v-else>
      <SectionBlock
        v-if="discovery.daily_flavor"
        title="今日方言词"
        action-text="查看义项"
        @action="toFlavor(discovery.daily_flavor.id)"
      >
        <view
          class="daily-card"
          @tap="toFlavor(discovery.daily_flavor.id)"
        >
          <view class="daily-name">
            {{ discovery.daily_flavor.name }}
          </view>
          <view class="daily-definition">
            {{ discovery.daily_flavor.definition }}
          </view>
          <button @tap.stop="recordFlavor(discovery.daily_flavor)">
            补录这个词
          </button>
        </view>
      </SectionBlock>

      <SectionBlock
        title="热罐头"
        :empty="!discovery.hot_cans.length"
        empty-title="还没有热罐头"
        empty-description="公开录音增加后，会按播放与收藏展示在这里。"
        empty-action-text="装一罐"
        @empty-action="recordFree"
      >
        <CanCard
          v-for="can in discovery.hot_cans"
          :key="can.id"
          :can="can"
          social
          @open="toCan"
          @comment="toCan"
        />
      </SectionBlock>

      <SectionBlock
        title="热义项"
        :empty="!discovery.hot_flavors.length"
        empty-title="还没有义项"
        empty-description="先去图鉴创建或浏览义项。"
        empty-action-text="打开图鉴"
        @empty-action="toFlavors"
      >
        <view class="flavor-grid">
          <view
            v-for="flavor in discovery.hot_flavors"
            :key="flavor.id"
            class="flavor-card"
            @tap="toFlavor(flavor.id)"
          >
            <view class="flavor-name">
              {{ flavor.name }}
            </view>
            <view class="flavor-definition">
              {{ flavor.definition }}
            </view>
          </view>
        </view>
      </SectionBlock>

      <SectionBlock
        title="录音挑战"
        :empty="!discovery.topics.length"
        empty-title="挑战正在准备中"
        empty-description="现在也可以自由装罐，或为今日方言词补录。"
        empty-action-text="自由装罐"
        @empty-action="recordFree"
      >
        <view
          v-for="topic in discovery.topics"
          :key="topic.id"
          class="topic-card"
        >
          <view class="topic-title">
            {{ topic.title }}
          </view>
          <view class="topic-prompt">
            {{ topic.prompt }}
          </view>
          <button @tap="joinTopic(topic)">
            参与挑战
          </button>
        </view>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import CanCard from '@/components/CanCard.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { requireAuth } from '@/services/authGuard';
import { getDiscovery } from '@/services/guantou';

function emptyDiscovery() {
  return {
    daily_flavor: null,
    hot_cans: [],
    hot_flavors: [],
    topics: [],
  };
}

export default {
  components: { CanCard, PageShell, SectionBlock },
  data() {
    return { discovery: emptyDiscovery(), error: '', loading: false };
  },
  onLoad() {
    this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.discovery = { ...emptyDiscovery(), ...await getDiscovery() };
      } catch (error) {
        this.error = error.message || '发现页加载失败';
      } finally {
        this.loading = false;
      }
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toFlavor(id) {
      uni.navigateTo({ url: `/pages/flavors/details?id=${id}` });
    },
    toFlavors() {
      uni.navigateTo({ url: '/pages/flavors/index' });
    },
    toCircles() {
      uni.navigateTo({ url: '/pages/circles/index' });
    },
    recordFree() {
      if (!requireAuth('record_can', { page: 'discovery' })) return;
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    recordFlavor(flavor) {
      if (!requireAuth('record_can', {
        page: 'flavor_detail', flavorId: flavor.id, flavorName: flavor.name,
      })) return;
      uni.navigateTo({
        url: `/pages/cans/create?flavor=${flavor.id}&flavor_name=${encodeURIComponent(flavor.name)}`,
      });
    },
    joinTopic(topic) {
      if (!requireAuth('record_can', { page: 'discovery', challengeId: topic.id })) return;
      const flavor = topic.flavor
        ? `flavor=${topic.flavor.id}&flavor_name=${encodeURIComponent(topic.flavor.name)}`
        : `prompt=${encodeURIComponent(topic.prompt)}`;
      const dialect = topic.dialect ? `&dialect=${topic.dialect.id}` : '';
      uni.navigateTo({ url: `/pages/cans/create?${flavor}${dialect}` });
    },
  },
};
</script>

<style scoped>
.state { padding: 90rpx 20rpx; color: #6e7b72; text-align: center; }
.state.error { color: #9b3a2d; }
.daily-card { padding: 6rpx 4rpx; }
.daily-name { color: #1f5c43; font-size: 44rpx; font-weight: 900; }
.daily-definition { margin-top: 12rpx; color: #425148; line-height: 1.6; }
.daily-card button, .topic-card button {
  width: auto;
  margin: 20rpx 0 0;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 25rpx;
}
.daily-card button::after, .topic-card button::after { border: 0; }
.flavor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }
.flavor-card { min-width: 0; padding: 20rpx; border-radius: 14rpx; background: #f1f5ef; }
.flavor-name { color: #1d2a24; font-size: 30rpx; font-weight: 800; overflow-wrap: anywhere; }
.flavor-definition {
  display: -webkit-box;
  margin-top: 8rpx;
  overflow: hidden;
  color: #657168;
  font-size: 24rpx;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.topic-card { margin-bottom: 14rpx; padding: 22rpx; border-radius: 14rpx; background: #fff6e8; }
.topic-title { color: #694c24; font-size: 30rpx; font-weight: 800; }
.topic-prompt { margin-top: 8rpx; color: #6d5a3e; line-height: 1.5; }
</style>
