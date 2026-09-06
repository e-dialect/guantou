<template>
  <view>
    <BaseButton
      variant="ghost"
      text="收进集盒"
      @click="open"
    />
    <view
      v-if="visible"
      class="box-panel"
      aria-label="选择集盒"
    >
      <view class="box-actions">
        <text class="box-heading">
          收进哪一个盒子
        </text><BaseButton
          size="small"
          variant="ghost"
          text="收起"
          @click="visible = false"
        />
      </view>
      <template v-if="recording && choices.length > 1">
        <text class="box-note">
          选择盒内归属，不改变录音原有的词条关联。
        </text>
        <BaseButton
          v-for="entry in choices"
          :key="entry.id"
          :variant="selectedEntry === entry.id ? 'primary' : 'ghost'"
          :text="`${entryTitle(entry)} · ${entry.summary || ''}`"
          @click="selectedEntry = entry.id"
        />
      </template>
      <text
        v-if="recording && !choices.length"
        class="box-note"
      >
        尚未关联词条，将收进盒内的“待整理录音”。
      </text>
      <BaseLoading
        v-if="loading"
        text="正在读取集盒…"
      />
      <EmptyState
        v-else-if="error"
        :title="error"
        action-text="重试"
        @action="load"
      />
      <template v-else>
        <BaseButton
          v-for="box in boxes"
          :key="box.id"
          variant="ghost"
          :text="box.title"
          :disabled="busy || (choices.length > 1 && !selectedEntry)"
          @click="collect(box.id)"
        />
        <BaseButton
          v-if="next"
          size="small"
          variant="ghost"
          text="更多集盒"
          @click="load(true)"
        />
        <text
          v-if="!boxes.length"
          class="box-note"
        >
          先建一个盒子，再把喜欢的乡音收在一起。
        </text>
        <BaseForm
          ref="form"
          :data="form"
          :rules="rules"
        >
          <BaseField
            v-model="form.title"
            name="title"
            label="新集盒名称"
            placeholder="例如：月下乡音"
          />
          <BaseButton
            text="新建并收纳"
            :loading="busy"
            :disabled="choices.length > 1 && !selectedEntry"
            @click="createAndCollect"
          />
        </BaseForm>
      </template>
    </view>
  </view>
</template>
<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  listCollections, createCollection, addCollectionEntry, addCollectionRecording,
} from '@/services/collections';
import { entryTitle, pageResults } from '@/services/entryRecording';
import { requireAuth } from '@/services/authGuard';
import { notify } from '@/services/feedback';

export default {
  components: {
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
  },
  props: {
    entryId: {
      type: Number,
      default: null,
    },
    recording: {
      type: Object,
      default: null,
    },
  },
  data: () => ({
    visible: false,
    boxes: [],
    next: null,
    page: 1,
    loading: false,
    busy: false,
    error: '',
    selectedEntry: null,
    form: {
      title: '',
    },
    rules: {
      title: [{
        required: true,
        message: '请填写集盒名称',
      }],
    },
  }),
  computed: {
    choices() {
      const entries = (this.recording?.entry_links || []).filter((link) => link.is_current !== false && link.status !== 'rejected').map((link) => link.entry).filter(Boolean);
      return entries.filter((entry, index) => (
        entries.findIndex((item) => item.id === entry.id) === index
      ));
    },
  },
  methods: {
    entryTitle,
    open() {
      if (!requireAuth('manage_collection', {
        recordingId: this.recording?.id,
        entryId: this.entryId,
      })) return;
      this.selectedEntry = this.choices.length === 1 ? this.choices[0].id : null;
      this.visible = true;
      this.load();
    },
    async load(more = false) {
      this.loading = true;
      this.error = '';
      const page = more === true ? this.page + 1 : 1;
      try {
        const response = await listCollections({
          mine: true,
          page,
        });
        this.boxes = page === 1 ? pageResults(response) : [...this.boxes, ...pageResults(response)];
        this.next = response.next;
        this.page = page;
      } catch (error) {
        this.error = '集盒暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    async collect(id) {
      if (this.busy) return;
      this.busy = true;
      try {
        if (this.recording) {
          await addCollectionRecording(id, this.recording.id, this.selectedEntry);
        } else {
          await addCollectionEntry(id, this.entryId);
        }
        notify({
          title: '已收进集盒',
        });
        this.visible = false;
      } catch (error) {
        notify({
          title: error.message || '收纳失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    async createAndCollect() {
      if (this.busy || (await this.$refs.form.validate()) !== true) return;
      this.busy = true;
      let box;
      try {
        box = await createCollection({
          title: this.form.title,
        });
        this.form.title = '';
        this.boxes = [box, ...this.boxes];
      } catch (error) {
        notify({
          title: error.message || '创建失败',
        });
      } finally {
        this.busy = false;
      }
      if (box) await this.collect(box.id);
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
