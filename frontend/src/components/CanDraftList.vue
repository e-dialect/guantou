<template>
  <view>
    <EmptyState
      v-if="!drafts.length"
      title="还没有装罐草稿"
      description="录音或填写中的内容会在离开页面、上传失败或提交失败时保存在这里。"
      action-text="去装一罐"
      @action="toCreate"
    />
    <view
      v-else
      class="draft-list"
    >
      <view
        v-for="draft in drafts"
        :key="draft.id"
        class="draft-card"
        @tap="editDraft(draft.id)"
      >
        <view class="draft-head">
          <text class="mode-tag">
            {{ modeLabel(draft) }}
          </text>
          <text class="draft-time">
            {{ formatDate(draft.updatedAt || draft.createdAt) }}
          </text>
        </view>
        <view class="draft-title">
          {{ draftTitle(draft) }}
        </view>
        <view class="draft-meta">
          {{ draftMeta(draft) }}
        </view>
        <view class="draft-actions">
          <button
            class="continue-button"
            @tap.stop="editDraft(draft.id)"
          >
            继续编辑
          </button>
          <button
            class="delete-button"
            @tap.stop="confirmDelete(draft)"
          >
            删除
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import { listCanDraftsWithAudioStatus, removeCanDraft } from '@/services/canDrafts';
import { goCreateCan } from '@/services/navigation';

function pad(value) {
  return String(value).padStart(2, '0');
}

export default {
  name: 'CanDraftList',
  components: { EmptyState },
  emits: ['loaded'],
  data() {
    return { drafts: [] };
  },
  mounted() {
    this.loadDrafts();
  },
  methods: {
    async loadDrafts() {
      this.drafts = await listCanDraftsWithAudioStatus();
      this.$emit('loaded', this.drafts);
    },
    modeLabel(draft) {
      return draft.mode === 'flavor' ? '义项补录' : '自由装罐';
    },
    draftTitle(draft) {
      if (draft.mode === 'flavor' && draft.targetFlavor?.name) {
        return `为「${draft.targetFlavor.name}」补录音`;
      }
      return draft.form?.concept_text || draft.label?.text_content || '未填写普通话概念';
    },
    draftMeta(draft) {
      const dialect = draft.dialectName || '未选择方言点';
      let audio = '未录音';
      if (draft.audio?.available) audio = '已保存录音';
      if (draft.audio && !draft.audio.available) audio = '录音已失效，请重录';
      return `${dialect} · ${audio}`;
    },
    formatDate(timestamp) {
      const date = new Date(Number(timestamp));
      if (!timestamp || Number.isNaN(date.getTime())) return '时间未知';
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },
    toCreate() {
      goCreateCan();
    },
    editDraft(id) {
      goCreateCan({ draft: id });
    },
    confirmDelete(draft) {
      uni.showModal({
        title: '删除草稿',
        content: `确定删除“${this.draftTitle(draft)}”吗？`,
        confirmColor: '#9b3a2d',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await removeCanDraft(draft.id);
            await this.loadDrafts();
            uni.showToast({ title: '草稿已删除', icon: 'success' });
          } catch (error) {
            uni.showToast({ title: '草稿删除失败，请稍后重试', icon: 'none' });
          }
        },
      });
    },
  },
};
</script>

<style scoped>
.draft-list {
  display: grid;
  gap: 20rpx;
  padding-bottom: 48rpx;
}

.draft-card {
  background: #ffffff;
  border: 1px solid #e1e6dc;
  border-radius: 16rpx;
  padding: 24rpx;
}

.draft-head,
.draft-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.mode-tag {
  color: #1f5c43;
  background: #e8f1eb;
  border-radius: 999rpx;
  padding: 6rpx 16rpx;
  font-size: 24rpx;
}

.draft-time,
.draft-meta {
  color: #6c776e;
  font-size: 24rpx;
}

.draft-title {
  margin-top: 20rpx;
  color: #1d2a24;
  font-size: 34rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.draft-meta {
  margin-top: 12rpx;
}

.draft-actions {
  justify-content: flex-end;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1px solid #eef1eb;
}

.continue-button,
.delete-button {
  width: auto;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.continue-button {
  color: #ffffff;
  background: #1f5c43;
}

.delete-button {
  color: #9b3a2d;
  background: #fff4f1;
}
</style>
