<template>
  <PageShell title="添加读音">
    <view
      v-if="loading"
      class="loading-state"
    >
      正在准备读音表单…
    </view>
    <view
      v-else-if="loadError"
      class="load-error"
    >
      <text>{{ loadError }}</text>
      <button @tap="loadOptions">
        重试
      </button>
    </view>
    <template v-else-if="flavor">
      <SectionBlock title="锁定义项">
        <view class="flavor-name">
          {{ flavor.name }}
        </view>
        <view class="flavor-definition">
          {{ flavor.definition }}
        </view>
        <view class="draft-note">
          普通用户新增的读音会先保存为草稿，认证与驳回由审核人员处理。
        </view>
      </SectionBlock>

      <SectionBlock title="读音资料">
        <view class="field-label">
          IPA <text class="required">
            *
          </text>
        </view>
        <input
          v-model="draft.ipa"
          class="field"
          maxlength="120"
          placeholder="例如 hiŋ²³"
          :focus="ipaFocused"
        >
        <view
          v-if="fieldErrors.ipa"
          class="field-error"
        >
          {{ fieldErrors.ipa }}
        </view>

        <view class="field-label">
          写法 <text class="required">
            *
          </text>
        </view>
        <picker
          :range="packageOptions"
          range-key="label"
          :value="packageIndex"
          @change="onPackageChange"
        >
          <view :class="['picker-field', { placeholder: !draft.package_id }]">
            {{ selectedPackageLabel }}
          </view>
        </picker>
        <view
          v-if="fieldErrors.package_id"
          class="field-error"
        >
          {{ fieldErrors.package_id }}
        </view>
        <view
          v-if="!packageOptions.length"
          class="field-hint warning"
        >
          该义项还没有关联写法，请先通过贴铭牌建立写法关系。
        </view>

        <view class="field-label">
          方言点 <text class="required">
            *
          </text>
        </view>
        <picker
          :range="dialectOptions"
          range-key="label"
          :value="dialectIndex"
          @change="onDialectChange"
        >
          <view :class="['picker-field', { placeholder: !draft.dialect_id }]">
            {{ selectedDialectLabel }}
          </view>
        </picker>
        <view
          v-if="fieldErrors.dialect_id"
          class="field-error"
        >
          {{ fieldErrors.dialect_id }}
        </view>

        <view class="field-label">
          读音类型
        </view>
        <picker
          :range="readingTypes"
          range-key="label"
          :value="readingTypeIndex"
          @change="onReadingTypeChange"
        >
          <view class="picker-field">
            {{ readingTypes[readingTypeIndex].label }}
          </view>
        </picker>

        <view class="field-label">
          变调前形式
        </view>
        <input
          v-model="draft.base_romanization"
          class="field"
          maxlength="120"
          placeholder="例如 hing5；与变调后形式成对填写"
        >
        <view
          v-if="fieldErrors.base_romanization"
          class="field-error"
        >
          {{ fieldErrors.base_romanization }}
        </view>

        <view class="field-label">
          变调后形式
        </view>
        <input
          v-model="draft.surface_romanization"
          class="field"
          maxlength="120"
          placeholder="例如 hing2；与变调前形式成对填写"
        >
        <view
          v-if="fieldErrors.surface_romanization"
          class="field-error"
        >
          {{ fieldErrors.surface_romanization }}
        </view>

        <view class="field-label">
          变调环境
        </view>
        <input
          v-model="draft.sandhi_environment"
          class="field"
          maxlength="160"
          placeholder="例如词中、连读或特定句法环境"
        >
        <view
          v-if="fieldErrors.sandhi_info"
          class="field-error"
        >
          {{ fieldErrors.sandhi_info }}
        </view>

        <view class="field-label">
          用法说明
        </view>
        <textarea
          v-model="draft.usage_note"
          class="field textarea"
          placeholder="适用语境、文白差异或其他说明"
        />
        <view
          v-if="fieldErrors.usage_note"
          class="field-error"
        >
          {{ fieldErrors.usage_note }}
        </view>

        <view class="field-label">
          来源
        </view>
        <input
          v-model="draft.source_citation"
          class="field"
          maxlength="300"
          placeholder="田野记录、方言志或其他来源"
        >
        <view
          v-if="fieldErrors.source_citation"
          class="field-error"
        >
          {{ fieldErrors.source_citation }}
        </view>

        <button
          class="primary-button"
          :disabled="submitting || !packageOptions.length"
          @tap="submit"
        >
          {{ submitting ? '提交中…' : '保存读音' }}
        </button>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import {
  createPronunciation,
  getFlavor,
  listAllDialects,
} from '@/services/guantou';

const READING_TYPES = [
  { value: 'general', label: '通用' },
  { value: 'literary', label: '文读' },
  { value: 'colloquial', label: '白读' },
  { value: 'other', label: '其他' },
];

function blankDraft() {
  return {
    base_romanization: '',
    dialect_id: null,
    ipa: '',
    package_id: null,
    reading_type: 'general',
    sandhi_environment: '',
    source_citation: '',
    surface_romanization: '',
    usage_note: '',
  };
}

export function validatePronunciationDraft(draft) {
  const errors = {};
  if (!String(draft.ipa || '').trim()) errors.ipa = '请填写 IPA';
  if (!draft.package_id) errors.package_id = '请选择该义项下的写法';
  if (!draft.dialect_id) errors.dialect_id = '请选择方言点';
  const base = String(draft.base_romanization || '').trim();
  const surface = String(draft.surface_romanization || '').trim();
  if (Boolean(base) !== Boolean(surface)) {
    errors.base_romanization = '变调前后形式必须成对填写';
    errors.surface_romanization = '变调前后形式必须成对填写';
  }
  if (draft.sandhi_environment && !(base && surface)) {
    errors.sandhi_info = '填写变调环境时必须同时填写变调前后形式';
  }
  return errors;
}

function fieldMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fieldMessage(value[0]);
  return value.message || value.detail || '';
}

export function pronunciationApiErrors(error) {
  return Object.entries(error?.data || {}).reduce((result, [field, value]) => {
    const message = fieldMessage(value);
    return message ? { ...result, [field]: message } : result;
  }, {});
}

export default {
  components: {
    PageShell,
    SectionBlock,
  },
  data() {
    return {
      dialectOptions: [],
      draft: blankDraft(),
      fieldErrors: {},
      flavor: null,
      flavorId: 0,
      ipaFocused: false,
      loadError: '',
      loading: false,
      packageOptions: [],
      readingTypes: READING_TYPES,
      submitting: false,
    };
  },
  computed: {
    packageIndex() {
      const index = this.packageOptions.findIndex(
        (item) => Number(item.value) === Number(this.draft.package_id),
      );
      return index < 0 ? 0 : index;
    },
    dialectIndex() {
      const index = this.dialectOptions.findIndex(
        (item) => Number(item.value) === Number(this.draft.dialect_id),
      );
      return index < 0 ? 0 : index;
    },
    readingTypeIndex() {
      const index = this.readingTypes.findIndex(
        (item) => item.value === this.draft.reading_type,
      );
      return index < 0 ? 0 : index;
    },
    selectedPackageLabel() {
      return this.packageOptions.find(
        (item) => Number(item.value) === Number(this.draft.package_id),
      )?.label || '请选择关联写法';
    },
    selectedDialectLabel() {
      return this.dialectOptions.find(
        (item) => Number(item.value) === Number(this.draft.dialect_id),
      )?.label || '请选择方言点';
    },
  },
  async onLoad(options) {
    this.flavorId = Number(options.flavor_id || options.flavor);
    await this.loadOptions();
  },
  methods: {
    async loadOptions() {
      if (!this.flavorId) {
        this.loadError = '缺少义项参数';
        return;
      }
      this.loading = true;
      this.loadError = '';
      try {
        const [flavor, dialects] = await Promise.all([
          getFlavor(this.flavorId),
          listAllDialects(),
        ]);
        this.flavor = flavor;
        this.packageOptions = (flavor.package_links || []).map((link) => ({
          value: link.package.id,
          label: `${link.package.text} · ${link.mapping_type}`,
        }));
        this.dialectOptions = dialects.map((dialect) => ({
          value: dialect.id,
          label: `${'　'.repeat(dialect.depth || 0)}${dialect.qualified_code || dialect.name}`,
        }));
        if (this.packageOptions.length === 1) {
          this.draft.package_id = this.packageOptions[0].value;
        }
        // #ifdef H5
        this.ipaFocused = true;
        // #endif
      } catch (error) {
        this.loadError = '读音表单加载失败，请重试';
      } finally {
        this.loading = false;
      }
    },
    onPackageChange(event) {
      this.draft.package_id = this.packageOptions[Number(event.detail.value)]?.value || null;
      delete this.fieldErrors.package_id;
    },
    onDialectChange(event) {
      this.draft.dialect_id = this.dialectOptions[Number(event.detail.value)]?.value || null;
      delete this.fieldErrors.dialect_id;
    },
    onReadingTypeChange(event) {
      this.draft.reading_type = this.readingTypes[Number(event.detail.value)]?.value || 'general';
    },
    payload() {
      const environment = this.draft.sandhi_environment.trim();
      return {
        flavor_id: this.flavorId,
        package_id: Number(this.draft.package_id),
        dialect_id: Number(this.draft.dialect_id),
        ipa: this.draft.ipa.trim(),
        base_romanization: this.draft.base_romanization.trim(),
        surface_romanization: this.draft.surface_romanization.trim(),
        reading_type: this.draft.reading_type,
        sandhi_info: environment ? { environment } : {},
        usage_note: this.draft.usage_note.trim(),
        source_citation: this.draft.source_citation.trim(),
      };
    },
    async submit() {
      this.fieldErrors = validatePronunciationDraft(this.draft);
      if (Object.keys(this.fieldErrors).length) {
        uni.showToast({ title: '请检查读音表单', icon: 'none' });
        return;
      }
      this.submitting = true;
      try {
        await createPronunciation(this.payload());
        uni.showToast({ title: '读音已保存', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 500);
      } catch (error) {
        this.fieldErrors = pronunciationApiErrors(error);
        if (!Object.keys(this.fieldErrors).length) {
          uni.showToast({ title: error.message || '读音保存失败', icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.loading-state {
  padding: 70rpx 0;
  text-align: center;
  color: #7a867d;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f8ece8;
  color: #8b4438;
}

.load-error button {
  margin: 0;
  color: #8b4438;
  font-size: 24rpx;
}

.flavor-name {
  font-size: 38rpx;
  font-weight: 800;
}

.flavor-definition,
.draft-note {
  margin-top: 12rpx;
  color: #526158;
  line-height: 1.55;
}

.draft-note {
  padding: 14rpx;
  border-radius: 10rpx;
  background: #eef4ef;
  font-size: 24rpx;
}

.field-label {
  margin: 22rpx 0 10rpx;
  font-size: 27rpx;
  font-weight: 700;
}

.required,
.field-error,
.warning {
  color: #9f3e32;
}

.field,
.picker-field {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  padding: 18rpx;
  background: #ffffff;
}

.textarea {
  min-height: 130rpx;
}

.picker-field.placeholder {
  color: #8a958d;
}

.field-error,
.field-hint {
  margin-top: 8rpx;
  font-size: 23rpx;
}

.primary-button {
  width: 100%;
  margin-top: 30rpx;
  background: #1f5c43;
  color: #ffffff;
}

/* #ifdef H5 */
.field:focus {
  border-color: #1f5c43;
  outline: none;
}
/* #endif */

/* #ifndef H5 */
.field,
.picker-field {
  font-size: 28rpx;
}
/* #endif */
</style>
