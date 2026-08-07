<template>
  <view class="nameplate-composer">
    <input
      v-model="draft.text_content"
      class="field"
      :focus="focus"
      maxlength="20"
      placeholder="原样写法（可选）"
    >
    <textarea
      v-model="draft.definition"
      class="textarea"
      maxlength="80"
      placeholder="释义或你的判断"
    />
    <input
      v-model="draft.pronunciation_text"
      class="field"
      maxlength="40"
      placeholder="原样读音（IPA、罗马字等，可选）"
    >
    <picker
      :range="sourceTypes"
      range-key="label"
      @change="onSourceTypeChange"
    >
      <view class="select">
        来源：{{ sourceTypeLabel }}
      </view>
    </picker>
    <input
      v-model="draft.source.attributed_to"
      class="field"
      maxlength="50"
      placeholder="讲述人、作者、编者或采集者（选填）"
    >
    <view class="split">
      <input
        v-model="draft.source.title"
        class="field"
        maxlength="60"
        placeholder="书名、文章或档案名"
      >
      <input
        v-model="draft.source.locator"
        class="field"
        maxlength="30"
        placeholder="页码或条目号"
      >
    </view>
    <input
      v-model="draft.source.note"
      class="field"
      maxlength="80"
      placeholder="补充来源说明（选填）"
    >
    <button
      class="submit"
      :disabled="submitting"
      @tap="submit"
    >
      {{ submitting ? '提交中...' : '贴上铭牌' }}
    </button>
  </view>
</template>

<script>
export const NAMEPLATE_SOURCE_TYPES = [
  { label: '创作者自述', value: 'creator' },
  { label: '口述', value: 'oral' },
  { label: '田野记录', value: 'fieldwork' },
  { label: '书籍', value: 'book' },
  { label: '论文/文章', value: 'article' },
  { label: '档案', value: 'archive' },
  { label: '网页', value: 'web' },
  { label: '其他', value: 'other' },
];

export function createNameplateDraft() {
  return {
    text_content: '',
    definition: '',
    pronunciation_text: '',
    source: {
      type: 'creator',
      title: '',
      attributed_to: '',
      locator: '',
      note: '',
    },
  };
}

export function normalizeNameplateDraft(draft) {
  const source = (draft && draft.source) || {};
  return {
    text_content: String((draft && draft.text_content) || '').trim(),
    definition: String((draft && draft.definition) || '').trim(),
    pronunciation_text: String((draft && draft.pronunciation_text) || '').trim(),
    source: {
      type: source.type || 'creator',
      title: String(source.title || '').trim(),
      attributed_to: String(source.attributed_to || '').trim(),
      locator: String(source.locator || '').trim(),
      note: String(source.note || '').trim(),
    },
  };
}

export default {
  name: 'NameplateComposer',
  props: {
    submitting: {
      type: Boolean,
      default: false,
    },
    focus: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['submit'],
  data() {
    return {
      draft: createNameplateDraft(),
      sourceTypes: NAMEPLATE_SOURCE_TYPES,
    };
  },
  computed: {
    sourceTypeLabel() {
      return this.sourceTypes.find((item) => item.value === this.draft.source.type)?.label || '其他';
    },
  },
  methods: {
    reset() {
      this.draft = createNameplateDraft();
    },
    onSourceTypeChange(event) {
      this.draft.source.type = this.sourceTypes[event.detail.value].value;
    },
    submit() {
      const payload = normalizeNameplateDraft(this.draft);
      if (!payload.text_content && !payload.pronunciation_text) {
        uni.showToast({ title: '请填写原样写法或读音', icon: 'none' });
        return;
      }
      this.$emit('submit', payload);
    },
  },
};
</script>

<style scoped>
.nameplate-composer {
  margin-top: 22rpx;
  display: grid;
  gap: 14rpx;
}

.field,
.textarea,
.select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  background: #ffffff;
  padding: 20rpx;
}

.textarea {
  min-height: 120rpx;
}

.split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12rpx;
}

.submit {
  margin-top: 10rpx;
  background: #1f5c43;
  color: #ffffff;
  border-radius: 12rpx;
}

.submit[disabled] {
  background: #aeb9b1;
}
</style>
