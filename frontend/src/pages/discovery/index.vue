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
      hover-class="state--pressed"
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
          hover-class="card--pressed"
          @tap="toFlavor(discovery.daily_flavor.id)"
        >
          <view class="daily-name">
            {{ discovery.daily_flavor.name }}
          </view>
          <view class="daily-definition">
            {{ discovery.daily_flavor.definition }}
          </view>
          <button
            class="card-button"
            hover-class="card-button--pressed"
            @tap.stop="recordFlavor(discovery.daily_flavor)"
          >
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
            hover-class="card--pressed"
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
          <button
            class="card-button"
            hover-class="card-button--pressed"
            @tap="joinTopic(topic)"
          >
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
import {
  goAtlas, goCanDetail, goCircleList, goCreateCan, goFlavorDetail,
} from '@/services/navigation';

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
      goCanDetail(id);
    },
    toFlavor(id) {
      goFlavorDetail(id);
    },
    toFlavors() {
      goAtlas();
    },
    toCircles() {
      goCircleList();
    },
    recordFree() {
      if (!requireAuth('record_can', { page: 'discovery' })) return;
      goCreateCan();
    },
    recordFlavor(flavor) {
      if (!requireAuth('record_can', {
        page: 'flavor_detail', flavorId: flavor.id, flavorName: flavor.name,
      })) return;
      goCreateCan({ flavor: flavor.id, flavor_name: flavor.name });
    },
    joinTopic(topic) {
      if (!requireAuth('record_can', { page: 'discovery', challengeId: topic.id })) return;
      goCreateCan({
        flavor: topic.flavor?.id,
        flavor_name: topic.flavor?.name,
        prompt: topic.flavor ? undefined : topic.prompt,
        dialect: topic.dialect?.id,
      });
    },
  },
};
</script>

<style scoped>
.state {
  padding: 90rpx var(--space-3);
  color: var(--muted-color);
  text-align: center;
  transition: opacity 0.15s ease;
}

.state.error {
  color: var(--danger-color);
}

.state--pressed {
  opacity: 0.7;
}

.daily-card {
  padding: 6rpx 4rpx;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.daily-name {
  color: var(--accent-color);
  font-size: var(--font-size-xl);
  font-weight: 900;
}

.daily-definition {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.card-button {
  width: auto;
  margin: var(--space-3) 0 0;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
  font-size: var(--font-size-sm);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.card-button::after {
  border: 0;
}

.card-button--pressed {
  transform: scale(0.98);
  opacity: 0.9;
}

.flavor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.flavor-card {
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.flavor-name {
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.flavor-definition {
  display: -webkit-box;
  margin-top: var(--space-1);
  overflow: hidden;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.topic-card {
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.topic-title {
  color: var(--warning-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.topic-prompt {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  line-height: 1.5;
}

.card--pressed {
  transform: scale(0.99);
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .state,
  .daily-card,
  .card-button,
  .flavor-card {
    transition: none;
  }
}
</style>
