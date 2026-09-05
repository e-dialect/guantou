<template>
  <PageShell title="管理与审核">
    <view class="summary card">
      <view class="eyebrow">
        按授权范围显示
      </view>
      <view class="title">
        {{ summaryText }}
      </view>
      <view class="copy">
        整理结论必须留下理由；拆分、合并、缩小地区和竞争解释还必须关联原始证据。这里不会进入 Django 系统后台。
      </view>
    </view>

    <view
      v-if="loading"
      class="card muted"
    >
      正在读取待办…
    </view>
    <EmptyState
      v-else-if="error"
      title="工作台加载失败"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <EmptyState
      v-else-if="!tasks.length"
      title="当前范围没有待办"
      description="新的待考写法、地区读音和竞争解释出现后，会按你的授权范围进入这里。"
    />
    <view v-else>
      <view
        v-for="task in tasks"
        :key="`${task.kind}-${task.id}`"
        class="task card"
      >
        <view class="task-head">
          <view>
            <view class="eyebrow">
              {{ kindLabel(task.kind) }}
            </view>
            <view class="task-title">
              {{ task.title }}
            </view>
          </view>
          <DialectLabel
            v-if="task.dialect"
            :dialect="task.dialect"
            mode="card"
          />
        </view>
        <view class="copy">
          {{ task.summary }}
        </view>
        <BaseField
          v-if="selectedKey === taskKey(task)"
          v-model="reason"
          :name="`reason-${task.kind}-${task.id}`"
          type="textarea"
          label="审核理由"
          :maxlength="500"
          placeholder="说明采纳、保留争议或退回的依据"
          :error="reasonError"
          @change="reasonError = ''"
        />
        <view class="task-actions">
          <BaseButton
            v-for="action in task.actions"
            :key="action"
            size="small"
            :variant="action === primaryAction(task) ? 'primary' : 'ghost'"
            :loading="submittingKey === `${taskKey(task)}-${action}`"
            :text="actionLabel(action)"
            @click="choose(task, action)"
          />
        </view>
        <view
          v-if="selectedKey === taskKey(task)"
          class="confirm-row"
        >
          <BaseButton
            size="small"
            variant="ghost"
            text="取消"
            @click="cancel"
          />
          <BaseButton
            size="small"
            :disabled="submittingKey !== ''"
            :text="`确认${actionLabel(selectedAction)}`"
            @click="submit(task)"
          />
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import DialectLabel from '@/components/DialectLabel.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  createCurationAction,
  getCurationSummary,
  listCurationTasks,
  pageResults,
} from '@/services/entryRecording';
import { notify, notifySuccess } from '@/services/feedback';

const LABELS = {
  accepted: '采纳', published: '发布', reviewed: '核对通过', disputed: '保留争议', rejected: '退回',
};

export default {
  components: {
    PageShell, BaseButton, BaseField, DialectLabel, EmptyState,
  },
  data() {
    return {
      summary: null,
      tasks: [],
      loading: true,
      error: '',
      selectedKey: '',
      selectedAction: '',
      reason: '',
      reasonError: '',
      submittingKey: '',
    };
  },
  computed: {
    summaryText() {
      const count = this.tasks.length;
      const grants = this.summary?.grants || [];
      const scopes = grants.map((grant) => (
        grant.role === 'lexical_curator'
          ? '词条整理'
          : `地区整理 · ${grant.dialect?.name || '指定范围'}`
      ));
      return `${count} 项待办${scopes.length ? ` · ${scopes.join(' / ')}` : ''}`;
    },
  },
  onLoad() { this.load(); },
  methods: {
    taskKey(task) { return `${task.kind}-${task.id}`; },
    kindLabel(kind) {
      return ({
        legacy_candidate: '旧库候选',
        entry: '词条',
        sense: '义项',
        recording: '录音',
        pronunciation: '地区读音',
        recording_link: '录音关联',
      })[kind] || '待整理资料';
    },
    actionLabel(action) { return LABELS[action] || action; },
    primaryAction(task) { return task.actions?.[0] || ''; },
    choose(task, action) {
      this.selectedKey = this.taskKey(task);
      this.selectedAction = action;
      this.reason = '';
      this.reasonError = '';
    },
    cancel() {
      this.selectedKey = '';
      this.selectedAction = '';
      this.reason = '';
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const [summary, tasks] = await Promise.all([getCurationSummary(), listCurationTasks()]);
        this.summary = summary;
        this.tasks = pageResults(tasks);
      } catch (error) { this.error = error?.message || '请检查网络和整理权限后重试'; } finally { this.loading = false; }
    },
    payloadFor(task) {
      if (task.target_type === 'legacy_candidate') {
        return {
          action_type: 'resolve_legacy',
          target_type: task.target_type,
          target_id: task.id,
          reason: this.reason.trim(),
          changes: { status: this.selectedAction },
        };
      }
      return {
        action_type: 'review',
        target_type: task.target_type,
        target_id: task.id,
        reason: this.reason.trim(),
        changes: { status: this.selectedAction },
      };
    },
    async submit(task) {
      if (this.reason.trim().length < 4) {
        this.reasonError = '请写下至少 4 个字的审核理由';
        return;
      }
      this.submittingKey = `${this.taskKey(task)}-${this.selectedAction}`;
      try {
        await createCurationAction(this.payloadFor(task));
        notifySuccess('审核记录已保存');
        this.cancel();
        await this.load();
      } catch (error) {
        notify({ title: error?.message || '审核保存失败' });
      } finally {
        this.submittingKey = '';
      }
    },
  },
};
</script>

<style scoped>
.card {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}
.eyebrow { color: var(--accent-color); font-size: var(--font-size-xs); font-weight: 700; }
.title { margin-top: var(--space-1); font-size: var(--font-size-xl); font-weight: 700; }
.copy, .muted { margin-top: var(--space-2); color: var(--text-secondary-color); line-height: 1.6; }
.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}
.task-title { margin-top: var(--space-1); font-weight: 700; overflow-wrap: anywhere; }
.task-actions,
.confirm-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.confirm-row {
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color);
}
</style>
