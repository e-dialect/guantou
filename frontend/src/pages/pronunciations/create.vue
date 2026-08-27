<template>
  <PageShell title="提交读音">
    <view class="pronunciation-create-page">
      <view
        v-if="loading"
        class="state-card"
      >
        正在准备读音表单…
      </view>
      <view
        v-else-if="loadError"
        class="state-card state-card--error"
      >
        <text>{{ loadError }}</text>
        <t-button
          v-if="flavorId"
          theme="primary"
          variant="outline"
          size="small"
          @click="loadOptions"
        >
          重试
        </t-button>
      </view>

      <template v-else-if="flavor">
        <view class="flavor-hero">
          <text class="flavor-eyebrow">
            为义项补充地方读法
          </text>
          <view class="flavor-name">
            {{ flavor.name }}
          </view>
          <view class="flavor-definition">
            {{ flavor.definition || '暂未填写义项释义' }}
          </view>
          <view class="draft-note">
            <text class="draft-note__icon">
              ◉
            </text>
            <text>义项已锁定；新增读音会先保存为草稿并进入审核。</text>
          </view>
        </view>

        <view class="form-section">
          <view class="section-heading">
            <view>
              <text class="section-step">
                01
              </text>
              <view class="section-title">
                核心资料
              </view>
            </view>
            <text class="section-meta">
              3 项必填
            </text>
          </view>

          <view class="field-sheet">
            <t-input
              v-model:value="draft.ipa"
              label="IPA"
              layout="vertical"
              required
              clearable
              :maxlength="120"
              placeholder="例如 hiŋ²³"
              :status="fieldErrors.ipa ? 'error' : 'default'"
              :tips="fieldErrors.ipa || '不确定声调值时，可以先按熟悉的方式填写'"
              @change="clearFieldError('ipa')"
            />

            <t-cell
              :class="{ 'selection-cell--complete': draft.package_id }"
              title="写法"
              required
              hover
              :note="selectedPackageLabel"
              :right-icon="packageRightIcon"
              @click="openPackagePicker"
            />
            <view
              v-if="fieldErrors.package_id"
              class="field-error cell-error"
            >
              {{ fieldErrors.package_id }}
            </view>
            <view
              v-if="!packageOptions.length"
              class="field-hint field-hint--warning"
            >
              该义项还没有关联写法，请先通过贴铭牌建立写法关系。
            </view>

            <t-cell
              :class="{ 'selection-cell--complete': draft.dialect_id }"
              title="方言点"
              required
              hover
              :note="selectedDialectLabel"
              :right-icon="dialectRightIcon"
              :bordered="false"
              @click="openDialectPicker"
            />
            <view
              v-if="fieldErrors.dialect_id"
              class="field-error cell-error"
            >
              {{ fieldErrors.dialect_id }}
            </view>
          </view>

          <view class="reading-type">
            <view class="reading-type__label">
              读音类型
            </view>
            <view class="reading-type__options">
              <t-button
                v-for="item in readingTypes"
                :key="item.value"
                block
                size="small"
                shape="round"
                :theme="draft.reading_type === item.value ? 'primary' : 'default'"
                :variant="draft.reading_type === item.value ? 'base' : 'text'"
                @click="selectReadingType(item.value)"
              >
                {{ item.label }}
              </t-button>
            </view>
            <view
              v-if="fieldErrors.reading_type"
              class="field-error"
            >
              {{ fieldErrors.reading_type }}
            </view>
          </view>
        </view>

        <t-picker
          :visible="packagePickerVisible"
          :value="packagePickerValue"
          title="选择写法"
          @change="onPackagePickerChange"
          @close="packagePickerVisible = false"
        >
          <t-picker-item :options="packageOptions" />
        </t-picker>

        <t-cascader
          :visible="dialectPickerVisible"
          :value="draft.dialect_id || undefined"
          title="选择方言点"
          placeholder="请选择"
          theme="tab"
          filterable
          filter-placeholder="搜索名称或方言点编码"
          :filter="filterDialectOption"
          :keys="dialectCascadeKeys"
          :options="dialectCascadeOptions"
          @change="onDialectCascadeChange"
          @close="dialectPickerVisible = false"
        >
          <template #middle-content>
            <view
              v-if="primaryDialect || recentDialects.length"
              class="dialect-shortcuts"
            >
              <view
                v-if="primaryDialect"
                class="dialect-shortcut-group"
              >
                <text class="dialect-shortcut-group__label">
                  默认方言点
                </text>
                <t-button
                  size="small"
                  theme="primary"
                  variant="outline"
                  @click="selectDialectShortcut(primaryDialect)"
                >
                  {{ dialectFullPath(primaryDialect.id) }}
                </t-button>
              </view>
              <view
                v-if="recentDialects.length"
                class="dialect-shortcut-group"
              >
                <text class="dialect-shortcut-group__label">
                  最近使用
                </text>
                <view class="dialect-shortcut-list">
                  <t-button
                    v-for="dialect in recentDialects"
                    :key="dialect.id"
                    size="small"
                    theme="default"
                    variant="outline"
                    @click="selectDialectShortcut(dialect)"
                  >
                    {{ dialectFullPath(dialect.id) }}
                  </t-button>
                </view>
              </view>
            </view>
          </template>
        </t-cascader>

        <t-collapse
          v-model:value="optionalSections"
          class="advanced-collapse"
          theme="card"
        >
          <t-collapse-panel
            value="advanced"
            header="更多语言学信息"
            header-right-content="变调、用法和来源"
          >
            <view class="advanced-fields">
              <t-input
                v-model:value="draft.base_romanization"
                label="变调前形式"
                layout="vertical"
                clearable
                :maxlength="120"
                placeholder="例如 hing5"
                :status="fieldErrors.base_romanization ? 'error' : 'default'"
                :tips="fieldErrors.base_romanization"
                @change="clearSandhiErrors"
              />
              <t-input
                v-model:value="draft.surface_romanization"
                label="变调后形式"
                layout="vertical"
                clearable
                :maxlength="120"
                placeholder="例如 hing2"
                :status="fieldErrors.surface_romanization ? 'error' : 'default'"
                :tips="fieldErrors.surface_romanization"
                @change="clearSandhiErrors"
              />
              <t-input
                v-model:value="draft.sandhi_environment"
                label="变调环境"
                layout="vertical"
                clearable
                :maxlength="160"
                placeholder="例如词中、连读或特定句法环境"
                :status="fieldErrors.sandhi_info ? 'error' : 'default'"
                :tips="fieldErrors.sandhi_info"
                @change="clearSandhiErrors"
              />

              <view class="textarea-field">
                <t-textarea
                  v-model:value="draft.usage_note"
                  label="用法说明"
                  autosize
                  indicator
                  :maxlength="300"
                  placeholder="适用语境、文白差异或其他说明"
                  @change="clearFieldError('usage_note')"
                />
                <view
                  v-if="fieldErrors.usage_note"
                  class="field-error textarea-error"
                >
                  {{ fieldErrors.usage_note }}
                </view>
              </view>

              <t-input
                v-model:value="draft.source_citation"
                label="资料来源"
                layout="vertical"
                clearable
                :maxlength="300"
                placeholder="田野记录、方言志或其他来源"
                :status="fieldErrors.source_citation ? 'error' : 'default'"
                :tips="fieldErrors.source_citation"
                @change="clearFieldError('source_citation')"
              />
            </view>
          </t-collapse-panel>
        </t-collapse>

        <view class="submit-card">
          <view class="submit-copy">
            <text class="submit-copy__title">
              {{ submitHint }}
            </text>
            <text class="submit-copy__detail">
              {{ submitting ? '请勿重复提交' : '保存成功后将返回义项详情' }}
            </text>
          </view>
          <t-button
            block
            size="large"
            theme="primary"
            :loading="submitting"
            :disabled="submitting || !packageOptions.length"
            @click="submit"
          >
            {{ submitting ? '提交中…' : '保存读音' }}
          </t-button>
        </view>
      </template>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import TButton from '@tdesign/uniapp/button/button.vue';
import TCascader from '@tdesign/uniapp/cascader/cascader.vue';
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import TInput from '@tdesign/uniapp/input/input.vue';
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import TTextarea from '@tdesign/uniapp/textarea/textarea.vue';
import {
  createPronunciation,
  getFlavor,
  listAllDialects,
} from '@/services/guantou';
import { getCanDraftOwnerScope } from '@/services/canDrafts';

const READING_TYPES = [
  { value: 'general', label: '通用' },
  { value: 'literary', label: '文读' },
  { value: 'colloquial', label: '白读' },
  { value: 'other', label: '其他' },
];

const PRONUNCIATION_FIELDS = new Set([
  'base_romanization',
  'dialect_id',
  'ipa',
  'package_id',
  'reading_type',
  'sandhi_info',
  'source_citation',
  'surface_romanization',
  'usage_note',
]);

const ADVANCED_FIELDS = new Set([
  'base_romanization',
  'sandhi_info',
  'source_citation',
  'surface_romanization',
  'usage_note',
]);

const RECENT_DIALECTS_STORAGE_KEY = 'can_create_recent_dialects_v1';
const MAX_RECENT_DIALECTS = 3;

function recentDialectOwnerScope() {
  try {
    return getCanDraftOwnerScope();
  } catch (error) {
    return 'anonymous:current';
  }
}

function sortDialects(items) {
  return items.sort((left, right) => (
    (left.sort_order || 0) - (right.sort_order || 0) || left.id - right.id
  ));
}

export function buildDialectTree(dialects = []) {
  const nodesByCode = new Map(dialects.map((dialect) => [
    dialect.qualified_code,
    { ...dialect, children: [] },
  ]));
  const roots = [];

  nodesByCode.forEach((node) => {
    const segments = node.qualified_code.split('.');
    const parentCode = segments.slice(0, -1).join('.');
    const parent = nodesByCode.get(parentCode);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  nodesByCode.forEach((node) => sortDialects(node.children));
  return sortDialects(roots);
}

export function findDialectPath(nodes, dialectId, path = []) {
  let matchedPath = [];
  nodes.some((node) => {
    const nextPath = [...path, node];
    if (String(node.id) === String(dialectId)) {
      matchedPath = nextPath;
      return true;
    }
    const childPath = findDialectPath(node.children, dialectId, nextPath);
    if (!childPath.length) return false;
    matchedPath = childPath;
    return true;
  });
  return matchedPath;
}

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
    if (!message || !PRONUNCIATION_FIELDS.has(field)) return result;
    return { ...result, [field]: message };
  }, {});
}

export default {
  components: {
    PageShell,
    TButton,
    TCascader,
    TCell,
    TCollapse,
    TCollapsePanel,
    TInput,
    TPicker,
    TPickerItem,
    TTextarea,
  },
  data() {
    return {
      dialectOwnerScope: recentDialectOwnerScope(),
      dialectPickerVisible: false,
      dialects: [],
      dialectTree: [],
      draft: blankDraft(),
      fieldErrors: {},
      flavor: null,
      flavorId: 0,
      loadError: '',
      loading: false,
      optionalOpen: false,
      packagePickerVisible: false,
      packageOptions: [],
      recentDialectIds: [],
      readingTypes: READING_TYPES,
      submitting: false,
    };
  },
  computed: {
    packagePickerValue() {
      return this.draft.package_id ? [Number(this.draft.package_id)] : [];
    },
    packageRightIcon() {
      return this.selectionRightIcon(Boolean(this.draft.package_id));
    },
    dialectRightIcon() {
      return this.selectionRightIcon(Boolean(this.draft.dialect_id));
    },
    selectedDialectPath() {
      return findDialectPath(this.dialectTree, this.draft.dialect_id);
    },
    primaryDialect() {
      const app = typeof getApp === 'function' ? getApp() : null;
      const primary = app?.globalData?.userInfo?.primary_dialect;
      if (!primary?.id) return null;
      return this.dialects.find((item) => String(item.id) === String(primary.id)) || primary;
    },
    recentDialects() {
      return this.recentDialectIds
        .map((id) => this.dialects.find((item) => String(item.id) === String(id)))
        .filter(Boolean)
        .filter((item) => String(item.id) !== String(this.primaryDialect?.id));
    },
    dialectCascadeKeys() {
      return { value: 'id', label: 'name', children: 'children' };
    },
    dialectCascadeOptions() {
      const normalize = (nodes = []) => nodes.map((node) => {
        const result = { ...node };
        if (node.children?.length) result.children = normalize(node.children);
        else delete result.children;
        return result;
      });
      return normalize(this.dialectTree);
    },
    optionalSections: {
      get() {
        return this.optionalOpen ? ['advanced'] : [];
      },
      set(value) {
        this.optionalOpen = Array.isArray(value) && value.includes('advanced');
      },
    },
    requiredRemaining() {
      return [
        String(this.draft.ipa || '').trim(),
        this.draft.package_id,
        this.draft.dialect_id,
      ].filter((value) => !value).length;
    },
    selectedPackageLabel() {
      return this.packageOptions.find(
        (item) => Number(item.value) === Number(this.draft.package_id),
      )?.label || '请选择关联写法';
    },
    selectedDialectLabel() {
      if (this.selectedDialectPath.length) {
        return this.selectedDialectPath.map((item) => item.name).join(' · ');
      }
      return '请选择方言点';
    },
    submitHint() {
      if (this.submitting) return '正在保存读音';
      if (Object.keys(this.fieldErrors).length) return '请检查标红内容';
      if (this.requiredRemaining) return `还有 ${this.requiredRemaining} 项必填内容`;
      return '必填资料已完整';
    },
  },
  async onLoad(options) {
    this.flavorId = Number(options.flavor_id || options.flavor);
    this.loadRecentDialectIds();
    await this.loadOptions();
  },
  methods: {
    selectionRightIcon(complete) {
      return complete
        ? {
          name: 'check-circle-filled',
          size: '20px',
          color: 'var(--success-color)',
        }
        : {
          name: 'chevron-right',
          size: '20px',
          color: 'var(--muted-color)',
        };
    },
    recentDialectsStorageKey() {
      return `${RECENT_DIALECTS_STORAGE_KEY}:${this.dialectOwnerScope}`;
    },
    loadRecentDialectIds() {
      try {
        const value = JSON.parse(uni.getStorageSync(this.recentDialectsStorageKey()) || '[]');
        this.recentDialectIds = Array.isArray(value) ? value.slice(0, MAX_RECENT_DIALECTS) : [];
      } catch (error) {
        this.recentDialectIds = [];
      }
    },
    rememberDialect(dialectId) {
      if (!dialectId) return;
      this.recentDialectIds = [
        Number(dialectId),
        ...this.recentDialectIds.filter((id) => String(id) !== String(dialectId)),
      ].slice(0, MAX_RECENT_DIALECTS);
      uni.setStorageSync(
        this.recentDialectsStorageKey(),
        JSON.stringify(this.recentDialectIds),
      );
    },
    dialectFullPath(dialectId) {
      const path = findDialectPath(this.dialectTree, dialectId);
      return path.length
        ? path.map((item) => item.name).join(' · ')
        : this.dialects.find((item) => String(item.id) === String(dialectId))?.qualified_code || '';
    },
    filterDialectOption(keyword, option, path = []) {
      const normalizedKeyword = String(keyword || '').trim().toLowerCase();
      if (!normalizedKeyword) return true;
      const searchable = [
        ...path.map((item) => item.name),
        option?.name,
        option?.qualified_code,
        option?.code,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedKeyword);
    },
    async loadOptions() {
      if (!this.flavorId) {
        this.loading = false;
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
        this.dialects = dialects;
        this.dialectTree = buildDialectTree(dialects);
        if (this.packageOptions.length === 1) {
          this.draft.package_id = this.packageOptions[0].value;
        }
      } catch (error) {
        this.loadError = '读音表单加载失败，请重试';
      } finally {
        this.loading = false;
      }
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    clearSandhiErrors() {
      this.clearFieldError('base_romanization');
      this.clearFieldError('surface_romanization');
      this.clearFieldError('sandhi_info');
    },
    openAdvancedForErrors() {
      if (Object.keys(this.fieldErrors).some((field) => ADVANCED_FIELDS.has(field))) {
        this.optionalOpen = true;
      }
    },
    openPackagePicker() {
      if (!this.packageOptions.length) return;
      this.packagePickerVisible = true;
    },
    onPackagePickerChange(context = {}) {
      const packageId = context.value?.[0];
      this.draft.package_id = packageId ? Number(packageId) : null;
      this.packagePickerVisible = false;
      this.clearFieldError('package_id');
    },
    openDialectPicker() {
      if (!this.dialects.length) return;
      this.dialectPickerVisible = true;
    },
    selectDialectShortcut(dialect) {
      if (!dialect?.id) return;
      this.draft.dialect_id = Number(dialect.id);
      this.rememberDialect(this.draft.dialect_id);
      this.dialectPickerVisible = false;
      this.clearFieldError('dialect_id');
    },
    onDialectCascadeChange(event = {}) {
      const detail = event.detail || event;
      const selectedOptions = detail.selectedOptions || [];
      const dialectId = detail.value;
      const selected = selectedOptions[selectedOptions.length - 1]
        || this.dialects.find((item) => String(item.id) === String(dialectId));
      if (!selected || selected.children?.length) return;

      this.draft.dialect_id = Number(dialectId || selected.id);
      this.rememberDialect(this.draft.dialect_id);
      this.dialectPickerVisible = false;
      this.clearFieldError('dialect_id');
    },
    selectReadingType(value) {
      this.draft.reading_type = value;
      this.clearFieldError('reading_type');
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
      if (this.submitting) return;
      this.fieldErrors = validatePronunciationDraft(this.draft);
      this.openAdvancedForErrors();
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
        // createPronunciation 使用 silent 请求；字段错误只在控件下方展示，避免重复弹窗。
        this.fieldErrors = pronunciationApiErrors(error);
        this.openAdvancedForErrors();
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
.pronunciation-create-page {
  width: 100%;
  max-width: 760rpx;
  margin: 0 auto;
  padding-bottom: var(--space-5);
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  color: var(--muted-color);
}

.state-card--error {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.flavor-hero {
  padding: var(--space-2) var(--space-1) var(--space-4);
}

.flavor-eyebrow,
.section-step {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 2rpx;
}

.flavor-name {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: 54rpx;
  font-weight: 800;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.flavor-definition {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-base);
  line-height: 1.55;
}

.draft-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.draft-note__icon {
  flex: 0 0 auto;
  color: var(--accent-color);
}

.form-section {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.section-title {
  margin-top: 4rpx;
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.section-meta {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.field-sheet,
.advanced-fields {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.field-sheet :deep(.t-input),
.advanced-fields :deep(.t-input),
.advanced-fields :deep(.t-textarea) {
  border-bottom: 1px solid var(--border-color);
}

.field-sheet :deep(.t-cell) {
  min-height: 104rpx;
  background: transparent;
}

.field-sheet :deep(.t-cell__title) {
  flex: 0 0 auto;
  color: var(--text-color);
  white-space: nowrap;
}

.field-sheet :deep(.t-cell__note) {
  min-width: 0;
  max-width: 430rpx;
  overflow: hidden;
  color: var(--text-secondary-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-sheet :deep(.t-cell__right-icon) {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  font-size: 20px;
}

.field-sheet :deep(.selection-cell--complete .t-cell__right-icon) {
  color: var(--success-color);
}

.advanced-fields > :last-child :deep(.t-input),
.advanced-fields > :last-child :deep(.t-textarea) {
  border-bottom: 0;
}

.cell-error,
.field-hint {
  padding: var(--space-1) var(--space-4) var(--space-2);
  background: var(--surface-color);
}

.field-error,
.field-hint--warning {
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}

.reading-type {
  margin-top: var(--space-3);
}

.reading-type__label {
  margin-bottom: var(--space-2);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.reading-type__options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.advanced-collapse {
  margin-bottom: var(--space-3);
}

.dialect-shortcuts {
  padding: 0 var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.dialect-shortcut-group + .dialect-shortcut-group {
  margin-top: var(--space-2);
}

.dialect-shortcut-group__label {
  display: block;
  margin-bottom: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.dialect-shortcut-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.textarea-field {
  border-bottom: 1px solid var(--border-color);
}

.textarea-error {
  padding: 0 var(--space-4) var(--space-2);
  background: var(--surface-color);
}

.submit-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.submit-copy {
  display: grid;
  gap: 4rpx;
  text-align: center;
}

.submit-copy__title {
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.submit-copy__detail {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

@media (max-width: 360px) {
  .form-section,
  .submit-card {
    padding: var(--space-3);
  }

  .reading-type__options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
