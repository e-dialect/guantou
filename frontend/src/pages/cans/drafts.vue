<template>
  <PageShell title="草稿箱">
    <view
      v-if="loading"
      class="state-card"
    >
      正在整理草稿…
    </view>
    <view
      v-else-if="loadError"
      class="state-card state-card--error"
    >
      <view>{{ loadError }}</view>
      <BaseButton
        variant="ghost"
        size="small"
        text="重试"
        @click="loadDrafts"
      />
    </view>
    <view
      v-else-if="!drafts.length"
      class="empty-state"
    >
      <view class="empty-title">
        还没有装罐草稿
      </view>
      <view class="empty-description">
        录音或填写中的内容会在离开页面、上传失败或提交失败时保存在这里。
      </view>
      <BaseButton
        text="去装一罐"
        @click="toCreate"
      />
    </view>
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
          <BaseButton
            size="small"
            text="继续编辑"
            @click.stop="editDraft(draft.id)"
          />
          <BaseButton
            variant="danger"
            size="small"
            text="删除"
            :loading="deletingId === draft.id"
            :disabled="Boolean(deletingId)"
            @click.stop="confirmDelete(draft)"
          />
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import confirmDialog from '@/components/ConfirmDialog';
import PageShell from '@/components/PageShell.vue';
import { listCanDraftsWithAudioStatus, removeCanDraft } from '@/services/canDrafts';
import { goCreateCan } from '@/services/navigation';

function pad(value) {
  return String(value).padStart(2, '0');
}

export default {
  components: { BaseButton, PageShell },
  data() {
    return {
      deletingId: '',
      drafts: [],
      loadError: '',
      loading: true,
    };
  },
  onShow() {
    this.loadDrafts();
  },
  methods: {
    async loadDrafts() {
      this.loading = true;
      this.loadError = '';
      try {
        this.drafts = await listCanDraftsWithAudioStatus();
      } catch (error) {
        this.loadError = '草稿加载失败，请稍后重试';
        uni.showToast({ title: this.loadError, icon: 'none' });
      } finally {
        this.loading = false;
      }
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
    async confirmDelete(draft) {
      const confirmed = await confirmDialog({
        title: '删除草稿',
        content: `确定删除“${this.draftTitle(draft)}”吗？`,
        danger: true,
      });
      if (!confirmed) return;
      this.deletingId = draft.id;
      try {
        await removeCanDraft(draft.id);
        await this.loadDrafts();
        uni.showToast({ title: '草稿已删除', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: '草稿删除失败，请稍后重试', icon: 'none' });
      } finally {
        this.deletingId = '';
      }
    },
  },
};
</script>

<style scoped>
.state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--muted-color);
}

.state-card--error {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.empty-state {
  padding: calc(var(--space-5) * 2) var(--space-3);
  text-align: center;
  color: var(--muted-color);
}

.empty-title {
  color: var(--text-secondary-color);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.empty-description {
  margin: var(--space-2) 0 var(--space-3);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.draft-list {
  display: grid;
  gap: var(--space-3);
  padding-bottom: var(--space-5);
}

.draft-card {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.draft-head,
.draft-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.mode-tag {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
}

.draft-time,
.draft-meta {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.draft-title {
  margin-top: var(--space-3);
  color: var(--text-color);
  font-size: var(--font-size-xl);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.draft-meta {
  margin-top: var(--space-2);
}

.draft-actions {
  justify-content: flex-end;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color);
}
</style>
