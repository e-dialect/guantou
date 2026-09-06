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
      <EmptyState
        v-if="!items.length"
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
        <text>{{ item.audio?.persisted ? '已保存音频' : '需要补充音频' }}</text>
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
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listRecordingDrafts, deleteRecordingDraft } from '@/services/recordingDrafts';
import { goRecord } from '@/services/navigation';
import { confirm, notify } from '@/services/feedback';

export default {
  components: {
    PageShell,
    BaseButton,
    EmptyState,
  },
  data: () => ({
    items: [],
  }),
  onShow() {
    this.items = listRecordingDrafts();
  },
  methods: {
    goRecord,
    async remove(id) {
      if (!(await confirm({
        title: '删除草稿？',
        content: '此设备保存的文字和录音将被删除。',
        danger: true,
      }))) return;
      try {
        await deleteRecordingDraft(id);
        this.items = listRecordingDrafts();
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
