<template>
  <view class="nameplate-composer">
    <input
      v-model="draft.text_content"
      class="field"
      :focus="focus"
      maxlength="20"
      placeholder="铭牌文字"
    >
    <textarea
      v-model="draft.definition"
      class="textarea"
      maxlength="80"
      placeholder="说明你的判断"
    />
    <input
      v-model="draft.source_citation"
      class="field"
      maxlength="50"
      placeholder="来源说明（选填）"
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
export function createNameplateDraft() {
  return {
    text_content: '',
    definition: '',
    source_citation: '',
  };
}

export function normalizeNameplateDraft(draft) {
  return {
    text_content: String((draft && draft.text_content) || '').trim(),
    definition: String((draft && draft.definition) || '').trim(),
    source_citation: String((draft && draft.source_citation) || '').trim(),
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
    };
  },
  methods: {
    reset() {
      this.draft = createNameplateDraft();
    },
    submit() {
      const payload = normalizeNameplateDraft(this.draft);
      if (!payload.text_content) {
        uni.showToast({ title: '请填写铭牌文字', icon: 'none' });
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
.textarea {
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
