<template>
  <PageShell :title="mine ? '我的集盒' : '主题集盒'">
    <view class="box-stack">
      <view class="box-cover">
        <text class="box-kicker">
          乡声集盒 · 一盒一段风土
        </text><text class="box-title">
          把散落的乡音，收在一起
        </text>
        <text class="box-note">
          从一个词出发，听见不同地方的说法。
        </text>
        <view class="box-actions">
          <BaseButton
            :variant="mine ? 'ghost' : 'primary'"
            text="逛集盒"
            @click="switchMode(false)"
          /><BaseButton
            :variant="mine ? 'primary' : 'ghost'"
            text="我的集盒"
            @click="switchMode(true)"
          />
        </view>
      </view>
      <BaseForm
        v-if="mine"
        ref="form"
        class="box-panel"
        :data="form"
        :rules="rules"
      >
        <BaseField
          v-model="form.title"
          name="title"
          label="新集盒名称"
          placeholder="例如：灶边的乡音"
        />
        <BaseButton
          text="创建私有集盒"
          :loading="busy"
          @click="create"
        />
      </BaseForm>
      <BaseLoading
        v-if="loading"
        text="正在打开集盒…"
      />
      <EmptyState
        v-else-if="error"
        :title="error"
        action-text="重试"
        @action="load"
      />
      <template v-else>
        <EmptyState
          v-if="!boxes.length"
          :title="mine ? '还没有自己的集盒' : '还没有公开集盒'"
        />
        <view
          v-for="box in boxes"
          :key="box.id"
          class="box-panel"
        >
          <text class="box-kicker">
            {{ box.is_public ? '公开集盒' : '私人珍藏' }}
          </text>
          <text class="box-heading">
            {{ box.title }}
          </text><text class="box-note">
            {{ box.description || '等待你收进第一段乡音' }}
          </text>
          <BaseButton
            variant="ghost"
            text="打开盒子"
            @click="goCollectionDetail(box.id)"
          />
        </view>
        <BaseButton
          v-if="next"
          variant="ghost"
          text="更多集盒"
          @click="load(true)"
        />
      </template>
    </view>
  </PageShell>
</template>
<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listCollections, createCollection } from '@/services/collections';
import { pageResults } from '@/services/entryRecording';
import { goCollectionDetail } from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { notify } from '@/services/feedback';

export default {
  components: {
    PageShell,
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
  },
  data: () => ({
    mine: false,
    boxes: [],
    next: null,
    page: 1,
    loading: false,
    busy: false,
    error: '',
    form: {
      title: '',
    },
    rules: {
      title: [{
        required: true,
        message: '请填写名称',
      }],
    },
  }),
  onLoad(options) {
    this.mine = options.mine === 'true';
  },
  onShow() {
    if (!this.mine || requireAuth('manage_collection')) this.load();
  },
  methods: {
    goCollectionDetail,
    switchMode(mine) {
      if (mine && !requireAuth('manage_collection')) return;
      this.mine = mine;
      this.load();
    },
    async load(more = false) {
      if (this.loading) return;
      this.loading = true;
      this.error = '';
      const page = more === true ? this.page + 1 : 1;
      try {
        const response = await listCollections({
          ...(this.mine ? {
            mine: true,
          } : {}),
          page,
        });
        this.boxes = page === 1 ? pageResults(response) : [...this.boxes, ...pageResults(response)];
        this.page = page;
        this.next = response.next;
      } catch (error) {
        this.error = '集盒暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    async create() {
      if (this.busy || (await this.$refs.form.validate()) !== true) return;
      this.busy = true;
      try {
        const box = await createCollection(this.form);
        this.form.title = '';
        goCollectionDetail(box.id);
      } catch (error) {
        notify({
          title: error.message || '创建失败',
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
