<template>
  <view class="nameplate-composer">
    <input
      v-model="draft.text_content"
      class="field"
      :focus="focus"
      maxlength="20"
      placeholder="原样写法（可选）"
    >
    <picker
      :range="packageOptions"
      range-key="text"
      @change="onPackageChange"
    >
      <view class="select">
        写法：{{ packageLabel }}
      </view>
    </picker>
    <picker
      :range="flavorOptions"
      range-key="name"
      @change="onFlavorChange"
    >
      <view class="select">
        义项：{{ flavorLabel }}
      </view>
    </picker>
    <picker
      :range="dialectOptions"
      range-key="qualified_code"
      @change="onDialectChange"
    >
      <view class="select">
        方言：{{ dialectLabel }}
      </view>
    </picker>
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
    package_id: null,
    flavor_id: null,
    dialect_id: null,
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
    ...((draft && draft.package_id) ? { package_id: Number(draft.package_id) } : {}),
    ...((draft && draft.flavor_id) ? { flavor_id: Number(draft.flavor_id) } : {}),
    ...((draft && draft.dialect_id) ? { dialect_id: Number(draft.dialect_id) } : {}),
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
    packages: {
      type: Array,
      default: () => [],
    },
    flavors: {
      type: Array,
      default: () => [],
    },
    dialects: {
      type: Array,
      default: () => [],
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
    packageOptions() {
      return [{ id: null, text: '原样新写法（自动按不确定归一）' }, ...this.packages];
    },
    flavorOptions() {
      return [{ id: null, name: '暂不选择义项' }, ...this.flavors];
    },
    dialectOptions() {
      return [{ id: null, qualified_code: '暂不选择方言点' }, ...this.dialects];
    },
    packageLabel() {
      return this.packageOptions.find((item) => item.id === this.draft.package_id)?.text
        || this.packageOptions[0].text;
    },
    flavorLabel() {
      return this.flavorOptions.find((item) => item.id === this.draft.flavor_id)?.name
        || this.flavorOptions[0].name;
    },
    dialectLabel() {
      return this.dialectOptions.find((item) => item.id === this.draft.dialect_id)?.qualified_code
        || this.dialectOptions[0].qualified_code;
    },
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
    onPackageChange(event) {
      this.draft.package_id = this.packageOptions[event.detail.value].id;
    },
    onFlavorChange(event) {
      this.draft.flavor_id = this.flavorOptions[event.detail.value].id;
    },
    onDialectChange(event) {
      this.draft.dialect_id = this.dialectOptions[event.detail.value].id;
    },
    submit() {
      const payload = normalizeNameplateDraft(this.draft);
      if (
        !payload.text_content
        && !payload.pronunciation_text
        && !payload.package_id
        && !payload.flavor_id
        && !payload.dialect_id
      ) {
        uni.showToast({ title: '请填写或选择至少一项主张', icon: 'none' });
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
