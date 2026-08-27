<template>
  <PageShell title="用同款发布">
    <view
      v-if="loading"
      class="state-card"
    >
      正在带入乡音罐头…
    </view>
    <view
      v-else-if="loadError"
      class="state-card state-card--error"
    >
      <view>{{ loadError }}</view>
      <BaseButton
        v-if="canId"
        variant="ghost"
        size="small"
        text="重试"
        @click="loadCan"
      />
    </view>
    <template v-else-if="can">
      <SectionBlock title="已带入的乡音">
        <view class="source-label">
          {{ sourceLabel }}
        </view>
        <view class="source-concept">
          {{ can.concept_text || '未填写普通话概念' }}
        </view>
        <view class="source-meta">
          {{ can.recorder?.nickname || can.recorder?.username || '匿名录音者' }} ·
          {{ can.submitted_dialect?.qualified_code || '未标方言点' }}
        </view>
        <view class="listen-action">
          <BaseButton
            variant="ghost"
            text="▶ 试听原罐头"
            :disabled="!can.audio_url"
            @click="playAudio(can.audio_url)"
          />
        </view>
      </SectionBlock>

      <SectionBlock title="补一句自己的表达">
        <BaseField
          v-model="text"
          name="text"
          label="想说的话（选填）"
          type="textarea"
          :error="fieldErrors.text"
          :maxlength="500"
          placeholder="可选，例如：我家也这样说"
          @input="clearFieldError('text')"
        />
        <view class="counter">
          {{ text.length }}/500
        </view>
        <view class="visibility-row">
          <BaseButton
            block
            :variant="visibility === 'public' ? 'primary' : 'ghost'"
            text="公开"
            @click="setVisibility('public')"
          />
          <BaseButton
            block
            :variant="visibility === 'private' ? 'primary' : 'ghost'"
            text="仅自己"
            @click="setVisibility('private')"
          />
        </view>
        <view
          v-if="fieldErrors.visibility"
          class="field-error"
        >
          {{ fieldErrors.visibility }}
        </view>
        <view
          v-if="fieldErrors.can_id"
          class="field-error"
        >
          {{ fieldErrors.can_id }}
        </view>
        <view class="publish-action">
          <BaseButton
            block
            :loading="submitting"
            :disabled="submitting || !can"
            :text="submitting ? '发布中…' : '发布表达'"
            @click="publish"
          />
        </view>
        <view class="hint">
          每条表达都必须保留这段罐头来源，不支持纯文字发布。
        </view>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { createCanPost } from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';
import { goPostDetail } from '@/services/navigation';
import { getCan } from '@/services/guantou';
import { playAudio } from '@/utils/audio';

const POST_FIELDS = new Set(['can_id', 'text', 'visibility']);

function fieldMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fieldMessage(value[0]);
  return value.message || value.detail || '';
}

export function postApiErrors(error) {
  return Object.entries(error?.data || {}).reduce((result, [field, value]) => {
    const message = fieldMessage(value);
    if (!message || !POST_FIELDS.has(field)) return result;
    return { ...result, [field]: message };
  }, {});
}

export default {
  components: {
    BaseButton,
    BaseField,
    PageShell,
    SectionBlock,
  },
  data() {
    return {
      can: null,
      canId: 0,
      fieldErrors: {},
      loadError: '',
      loading: true,
      submitting: false,
      text: '',
      visibility: 'public',
    };
  },
  computed: {
    sourceLabel() {
      return this.can.primary_nameplate?.display_text || '无标罐头';
    },
  },
  async onLoad(options = {}) {
    this.canId = Number(options.can_id || 0);
    if (!this.canId) {
      this.loading = false;
      this.loadError = '缺少要引用的罐头';
      return;
    }
    if (!requireAuth('use_same', { page: 'post_compose', canId: this.canId })) return;
    await this.loadCan();
  },
  methods: {
    playAudio,
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    setVisibility(value) {
      this.visibility = value;
      this.clearFieldError('visibility');
    },
    async loadCan() {
      this.loading = true;
      this.loadError = '';
      try {
        this.can = await getCan(this.canId);
      } catch (error) {
        this.loadError = error.message || '罐头加载失败';
      } finally {
        this.loading = false;
      }
    },
    async publish() {
      if (this.submitting || !this.can) return;
      this.fieldErrors = {};
      this.submitting = true;
      try {
        const post = await createCanPost(this.canId, this.text, this.visibility);
        uni.showToast({ title: '发布成功', icon: 'success' });
        goPostDetail(post.id, { replace: true });
      } catch (error) {
        // httpClient 负责通用失败 toast；页面只展示 data.<field> 的字段错误。
        this.fieldErrors = postApiErrors(error);
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.state-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--muted-color);
}

.state-card--error,
.field-error {
  color: var(--danger-color);
}

.state-card--error {
  border-color: var(--danger-color);
}

.source-label {
  color: var(--text-color);
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.source-concept,
.source-meta,
.hint,
.counter {
  margin-top: var(--space-1);
  color: var(--muted-color);
}

.listen-action,
.publish-action {
  margin-top: var(--space-3);
}

.counter {
  text-align: right;
  font-size: var(--font-size-xs);
}

.visibility-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.field-error {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
}

.hint {
  font-size: var(--font-size-xs);
  text-align: center;
}
</style>
