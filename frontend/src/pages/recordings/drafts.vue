<template>
  <PageShell title="录音草稿">
    <view class="box-stack">
      <view class="box-cover">
        <text class="box-kicker">
          留住未完成的乡音
        </text><text class="box-title">
          草稿箱
        </text><text>仅保存在当前设备，退出账号后仍会保留。</text>
      </view>
      <BaseLoading
        v-if="loading"
        text="正在检查草稿音频…"
      />
      <EmptyState
        v-else-if="!items.length"
        title="还没有草稿"
        action-text="录一段乡音"
        @action="goRecord"
      />
      <view
        v-for="item in items"
        :key="item.id"
        class="box-panel"
      >
        <text class="box-heading">
          {{ item.form.original_gloss || '未命名乡音' }}
        </text>
        <text>{{ item.audio?.available ? '已保存音频' : '音频不可用，文字仍保留，可继续补录' }}</text>
        <view class="box-actions">
          <BaseButton
            text="继续录制"
            @click="goRecord({ draft_id: item.id })"
          /><BaseButton
            variant="danger-ghost"
            text="删除"
            @click="remove(item.id)"
          />
        </view>
      </view>
    </view>
  </PageShell>
</template>
<script>
import PageShell from '@/components/PageShell.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listRecordingDraftsWithAudioStatus, deleteRecordingDraft, draftOwner } from '@/services/recordingDrafts';
import { goRecord } from '@/services/navigation';
import { confirm, notify } from '@/services/feedback';

export default {
  components: {
    BaseLoading,
    PageShell,
    BaseButton,
    EmptyState,
  },
  data: () => ({
    items: [],
    loading: false,
    owner: '',
    generation: 0,
  }),
  onShow() {
    this.load();
  },
  methods: {
    goRecord,
    async load() {
      this.generation += 1;
      const { generation } = this;
      const owner = draftOwner();
      this.loading = true;
      this.items = [];
      this.owner = owner;
      try {
        const items = await listRecordingDraftsWithAudioStatus(owner);
        if (generation === this.generation && draftOwner() === owner) this.items = items;
      } finally { if (generation === this.generation) this.loading = false; }
    },
    async remove(id) {
      const { owner } = this;
      if (!(await confirm({
        title: '删除草稿？',
        content: '此设备保存的文字和录音将被删除。',
        danger: true,
      }))) return;
      try {
        if (draftOwner() !== owner) { await this.load(); return; }
        await deleteRecordingDraft(id, owner);
        await this.load();
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
