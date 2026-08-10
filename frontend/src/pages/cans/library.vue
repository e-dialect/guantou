<template>
  <PageShell
    title="我的罐头库"
    :scroll="false"
    content-class="library-content"
  >
    <template #before>
      <view class="tabs">
        <button
          v-for="item in tabs"
          :key="item.key"
          :class="['tab', { active: tab === item.key }]"
          @tap="tab = item.key"
        >
          {{ item.label }}
        </button>
      </view>
    </template>

    <CanList
      v-if="tab !== 'drafts'"
      ref="canList"
      :fetcher="listCans"
      :query="canQuery"
      :owner-actions="tab === 'recorded'"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      :empty-action-text="emptyActionText"
      @open="toDetail"
      @reuse="toReuse"
      @delete="confirmDelete"
      @empty-action="runEmptyAction"
    />
    <scroll-view
      v-else
      scroll-y
      class="draft-scroll"
    >
      <CanDraftList />
    </scroll-view>
  </PageShell>
</template>

<script>
import CanDraftList from '@/components/CanDraftList.vue';
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import { deleteCan, listCans } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';

export default {
  components: { CanDraftList, CanList, PageShell },
  data() {
    return {
      tab: 'recorded',
      tabs: [
        { key: 'recorded', label: '我录制的' },
        { key: 'liked', label: '我收藏的' },
        { key: 'drafts', label: '草稿' },
      ],
    };
  },
  computed: {
    canQuery() {
      return this.tab === 'liked' ? { liked: true } : { mine: true };
    },
    emptyTitle() {
      return this.tab === 'liked' ? '还没有收藏罐头' : '还没有录制罐头';
    },
    emptyDescription() {
      return this.tab === 'liked'
        ? '浏览公开乡音时点一下爱心，就会收进这里。'
        : '先录下第一段乡音，提交后可以在这里继续管理。';
    },
    emptyActionText() {
      return this.tab === 'liked' ? '去逛罐头' : '装一罐';
    },
  },
  onLoad(options = {}) {
    if (!requireAuth('open_can_library', { page: 'can_library' })) return;
    if (['recorded', 'liked', 'drafts'].includes(options.tab)) this.tab = options.tab;
  },
  methods: {
    listCans,
    toDetail(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toReuse(id) {
      uni.navigateTo({ url: `/pages/cans/create?source_can=${id}` });
    },
    runEmptyAction() {
      uni.navigateTo({
        url: this.tab === 'liked' ? '/pages/cans/index' : '/pages/cans/create',
      });
    },
    confirmDelete(can) {
      const title = can.primary_nameplate?.display_text || can.concept_text || `罐头 #${can.id}`;
      uni.showModal({
        title: '删除录音',
        content: `确定删除“${title}”吗？相关铭牌和评论也会一并删除。`,
        confirmColor: '#9b3a2d',
        success: async (result) => {
          if (!result.confirm) return;
          try {
            await deleteCan(can.id);
            this.$refs.canList.removeItem(can.id);
            uni.showToast({ title: '已删除', icon: 'success' });
          } catch (error) {
            uni.showToast({ title: error.message || '删除失败', icon: 'none' });
          }
        },
      });
    },
  },
};
</script>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 20rpx 28rpx;
  background: #f6f7f3;
}

.tab {
  margin: 0;
  border-radius: 999rpx;
  background: #e8ece5;
  color: #617067;
  font-size: 25rpx;
  line-height: 64rpx;
}

.tab.active {
  background: #1f5c43;
  color: #ffffff;
}

.tab::after {
  border: 0;
}

.draft-scroll {
  height: 100%;
}

.draft-scroll :deep(> view) {
  padding-bottom: 60rpx;
}

:deep(.library-content) {
  height: calc(100vh - 164rpx);
  min-height: 0;
  padding: 20rpx 28rpx 60rpx;
}
</style>
