<template>
  <PageShell
    :title="pageTitle"
    action-text="草稿"
    @action="goDrafts"
  >
    <view
      v-if="loading"
      class="page-state page-state--loading"
    >
      <t-skeleton
        animation="flashed"
        :row-col="[
          { width: '100%', height: '320rpx' },
          1,
          [{ width: '58%' }, { width: '34%', marginLeft: '8%' }],
          1,
        ]"
      />
      <t-loading
        class="page-state__loading"
        theme="dots"
        size="36rpx"
        text="正在准备录音页…"
      />
    </view>
    <view
      v-else-if="loadError"
      class="page-state"
    >
      <t-result
        theme="error"
        title="页面暂时没准备好"
        :description="loadError"
      />
      <t-button
        theme="primary"
        variant="outline"
        size="small"
        @click="loadPage"
      >
        重试
      </t-button>
    </view>
    <template v-else>
      <view class="can-create-page">
        <view
          v-if="mode === 'flavor'"
          class="target-flavor"
        >
          正在为「{{ targetFlavor.name || '已有词条' }}」补录乡音
        </view>

        <AudioCapture
          :audio="audio"
          :invalid="audio.invalid"
          @change="onAudioChange"
          @clear="clearAudio"
          @error="onAudioError"
        />
        <view
          v-if="fieldErrors.audio_url"
          class="field-error audio-error"
        >
          {{ fieldErrors.audio_url }}
        </view>
        <view
          v-if="fieldErrors.initial_nameplate"
          class="field-error form-error"
        >
          {{ fieldErrors.initial_nameplate }}
        </view>

        <view class="form-sheet">
          <view class="form-sheet__heading">
            <text class="form-sheet__title">
              再告诉我们两件事
            </text>
          </view>

          <t-form
            class="essential-form"
            :data="form"
            label-align="left"
            label-width="112px"
            :show-error-message="false"
          >
            <t-form-item
              name="concept_text"
              label="普通话概念"
              :help="fieldErrors.concept_text"
              :required-mark="false"
            >
              <t-input
                v-model:value="form.concept_text"
                :class="{ 'concept-input--complete': conceptComplete }"
                borderless
                :disabled="mode === 'flavor'"
                placeholder="例如：膝盖、奶奶、走路"
                :maxlength="20"
                :status="conceptStatus"
                :suffix-icon="conceptSuffixIcon"
                @change="clearFieldError('concept_text')"
              />
            </t-form-item>

            <t-form-item
              name="submitted_dialect_id"
              label="方言点"
              :help="fieldErrors.submitted_dialect_id"
              :required-mark="false"
            >
              <t-cell
                v-if="dialects.length"
                :class="{ 'dialect-cell--complete': form.submitted_dialect_id }"
                :title="form.submitted_dialect_id ? dialectDisplayLabel : '选择省、市、区县'"
                :right-icon="dialectRightIcon"
                :bordered="false"
                hover
                @click="openDialectPicker"
              />
              <t-empty
                v-else
                class="dialect-empty-state"
                icon="map-location"
                description="方言点暂时加载失败"
              >
                <template #action>
                  <t-button
                    theme="primary"
                    variant="outline"
                    size="small"
                    @click="loadPage"
                  >
                    重新加载
                  </t-button>
                </template>
              </t-empty>
            </t-form-item>
          </t-form>
        </view>

        <t-cascader
          :visible="dialectPickerVisible"
          :value="form.submitted_dialect_id || undefined"
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
          class="optional-collapse"
          theme="card"
        >
          <t-collapse-panel
            value="extra"
          >
            <template #header>
              <view class="optional-summary">
                <text class="optional-summary__title">
                  想多说一点？（可选）
                </text>
                <text class="optional-summary__description">
                  可以补充写法、读音或来历
                </text>
              </view>
            </template>
            <view class="optional-fields">
              <view class="optional-group">
                <view class="optional-group__heading">
                  <t-icon
                    name="edit-1"
                    size="36rpx"
                  />
                  <text>写法与释义</text>
                </view>
                <t-input
                  v-model:value="label.text_content"
                  label="家乡话写法"
                  :maxlength="10"
                  placeholder="不确定可以留空"
                  :status="fieldErrors.text_content ? 'error' : 'default'"
                  :tips="fieldErrors.text_content"
                  @change="clearFieldError('text_content')"
                />
                <t-textarea
                  v-model:value="label.definition"
                  label="补充说明"
                  :maxlength="50"
                  placeholder="这句话什么时候会说？"
                  :status="fieldErrors.definition ? 'error' : 'default'"
                  :tips="fieldErrors.definition"
                  @change="clearFieldError('definition')"
                />
                <t-input
                  v-model:value="label.pronunciation_text"
                  label="原样读音"
                  :maxlength="40"
                  placeholder="按你熟悉的方式记下读音"
                  :status="fieldErrors.pronunciation_text ? 'error' : 'default'"
                  :tips="fieldErrors.pronunciation_text"
                  @change="clearFieldError('pronunciation_text')"
                />

                <view class="picker-field">
                  <view class="picker-label">
                    写法类型
                  </view>
                  <t-cell
                    :title="packageTypeLabel"
                    arrow
                    :bordered="false"
                    hover
                    @click="packageTypePickerVisible = true"
                  />
                </view>
              </view>

              <view class="optional-group">
                <view class="optional-group__heading">
                  <t-icon
                    name="map-information-1"
                    size="36rpx"
                  />
                  <text>来源与采集信息</text>
                </view>
                <view class="picker-field">
                  <view class="picker-label">
                    证据等级
                  </view>
                  <t-cell
                    :title="evidenceLabel"
                    arrow
                    :bordered="false"
                    hover
                    @click="evidencePickerVisible = true"
                  />
                </view>
                <view class="picker-field">
                  <view class="picker-label">
                    资料来源类型
                  </view>
                  <t-cell
                    :title="sourceTypeLabel"
                    arrow
                    :bordered="false"
                    hover
                    @click="sourceTypePickerVisible = true"
                  />
                </view>

                <t-input
                  v-model:value="label.source.attributed_to"
                  label="是谁说的"
                  :maxlength="50"
                  placeholder="例如：奶奶、村里的老人"
                  :status="fieldErrors.attributed_to ? 'error' : 'default'"
                  :tips="fieldErrors.attributed_to"
                  @change="clearFieldError('attributed_to')"
                />
                <t-input
                  v-model:value="label.source.note"
                  label="从哪里听到"
                  :maxlength="50"
                  placeholder="例如：小时候听奶奶说的"
                  :status="fieldErrors.note ? 'error' : 'default'"
                  :tips="fieldErrors.note"
                  @change="clearFieldError('note')"
                />
                <t-textarea
                  v-model:value="form.source_note"
                  label="其他备注"
                  :maxlength="80"
                  placeholder="还有想告诉我们的吗？"
                  :status="fieldErrors.source_note ? 'error' : 'default'"
                  :tips="fieldErrors.source_note"
                  @change="clearFieldError('source_note')"
                />
              </view>
            </view>
          </t-collapse-panel>
        </t-collapse>

        <t-picker
          :visible="packageTypePickerVisible"
          :value="[label.package_type]"
          title="选择写法类型"
          @change="onPackageTypeChange"
          @close="packageTypePickerVisible = false"
        >
          <t-picker-item :options="packageTypes" />
        </t-picker>

        <t-picker
          :visible="evidencePickerVisible"
          :value="[label.evidence_level]"
          title="选择证据等级"
          @change="onEvidenceChange"
          @close="evidencePickerVisible = false"
        >
          <t-picker-item :options="evidenceLevels" />
        </t-picker>

        <t-picker
          :visible="sourceTypePickerVisible"
          :value="[label.source.type]"
          title="选择资料来源类型"
          @change="onSourceTypeChange"
          @close="sourceTypePickerVisible = false"
        >
          <t-picker-item :options="sourceTypes" />
        </t-picker>

        <view class="submit-card">
          <text class="submit-card__hint">
            {{ submitHint }}
          </text>
          <t-button
            block
            size="large"
            theme="primary"
            :loading="submitting"
            :disabled="submitting || !dialects.length || !canSubmit"
            @click="submit"
          >
            {{ submitting ? '保存中…' : '保存这段乡音' }}
          </t-button>
        </view>

        <t-button
          v-if="mode === 'free'"
          class="existing-flavor-link"
          block
          variant="text"
          theme="primary"
          @click="goFlavorPicker"
        >
          想给已有词条补录声音？去选择词条
        </t-button>
        <t-toast ref="pageToast" />
      </view>
    </template>
  </PageShell>
</template>

<script>
import { buildDialectTree, findDialectPath } from '@/utils/dialectTree';
import SOURCE_OPTIONS from '@/utils/sourceOptions';
import AudioCapture from '@/components/AudioCapture.vue';
import PageShell from '@/components/PageShell.vue';
import TButton from '@tdesign/uniapp/button/button.vue';
import TCascader from '@tdesign/uniapp/cascader/cascader.vue';
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import TEmpty from '@tdesign/uniapp/empty/empty.vue';
import TForm from '@tdesign/uniapp/form/form.vue';
import TFormItem from '@tdesign/uniapp/form-item/form-item.vue';
import TIcon from '@tdesign/uniapp/icon/icon.vue';
import TInput from '@tdesign/uniapp/input/input.vue';
import TLoading from '@tdesign/uniapp/loading/loading.vue';
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import TResult from '@tdesign/uniapp/result/result.vue';
import TSkeleton from '@tdesign/uniapp/skeleton/skeleton.vue';
import TTextarea from '@tdesign/uniapp/textarea/textarea.vue';
import TToast from '@tdesign/uniapp/toast/toast.vue';
import { uploadFile } from '@/services/file';
import {
  createCanForFlavor,
  createCanWithNameplate,
  getFlavor,
  listAllDialects,
} from '@/services/guantou';
import {
  isLoggedIn,
  requireAuth,
  saveInterceptIntent,
} from '@/services/authGuard';
import {
  createCanDraftId,
  getCanDraftOwnerScope,
  getCanDraftWithAudio,
  listCanDrafts,
  removeCanDraft,
  saveCanDraft,
} from '@/services/canDrafts';
import { releaseDraftAudioUrl } from '@/services/canDraftAudio';
import {
  goAtlas,
  goCanDetail,
  goCanLibrary,
  goHome,
  ROUTES,
} from '@/services/navigation';

function initialForm() {
  return {
    audio_url: '',
    concept_text: '',
    submitted_dialect_id: null,
    source_note: '',
    duration_ms: 0,
  };
}

function initialLabel() {
  return {
    text_content: '',
    definition: '',
    pronunciation_text: '',
    package_type: 'uncertain',
    evidence_level: 1,
    source: {
      type: 'creator',
      title: '',
      attributed_to: '',
      locator: '',
      note: '',
    },
  };
}

const RECENT_DIALECTS_STORAGE_KEY = 'can_create_recent_dialects_v1';
const MAX_RECENT_DIALECTS = 3;

function fieldMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fieldMessage(value[0]);
  if (value.message || value.detail) return value.message || value.detail;
  if (typeof value === 'object') {
    return Object.values(value).map(fieldMessage).find(Boolean) || '';
  }
  return '';
}

export function canApiErrors(error) {
  return Object.entries(error?.data || {}).reduce((result, [field, value]) => {
    const message = fieldMessage(value);
    return message ? { ...result, [field]: message } : result;
  }, {});
}

export { buildDialectTree, findDialectPath };

export default {
  components: {
    AudioCapture,
    PageShell,
    TButton,
    TCascader,
    TCell,
    TCollapse,
    TCollapsePanel,
    TEmpty,
    TForm,
    TFormItem,
    TIcon,
    TInput,
    TLoading,
    TPicker,
    TPickerItem,
    TResult,
    TSkeleton,
    TTextarea,
    TToast,
  },
  data() {
    return {
      loading: false,
      loadError: '',
      dialectLoadFailed: false,
      pageOptions: {},
      contextReady: false,
      fieldErrors: {},
      submitting: false,
      submitted: false,
      draftAccessBlocked: false,
      draftId: '',
      draftOwnerScope: getCanDraftOwnerScope(),
      draftSavePromise: null,
      mode: 'free',
      targetFlavor: {
        id: '',
        name: '',
      },
      optionalOpen: false,
      dialectPickerVisible: false,
      evidencePickerVisible: false,
      packageTypePickerVisible: false,
      recentDialectIds: [],
      sourceTypePickerVisible: false,
      draftDialectName: '',
      dialects: [],
      dialectTree: [],
      dialectColumns: [],
      dialectIndexes: [],
      audio: {
        path: '',
        name: '',
        durationMs: 0,
        origin: '',
        available: true,
        invalid: false,
      },
      form: initialForm(),
      label: initialLabel(),
      packageTypes: [
        { label: '不确定', value: 'uncertain' },
        { label: '正字', value: 'orthodox' },
        { label: '借字', value: 'loan' },
        { label: '俗写', value: 'popular' },
        { label: '拟音', value: 'phonetic' },
        { label: '罗马字', value: 'romanization' },
      ],
      evidenceLevels: [
        { label: '本人记忆', value: 1 },
        { label: '社区公认', value: 2 },
        { label: '文献考据', value: 3 },
        { label: '官方认证', value: 4 },
      ],
      sourceTypes: SOURCE_OPTIONS,
    };
  },
  computed: {
    conceptComplete() {
      return this.mode === 'flavor'
        ? Boolean(this.targetFlavor.id)
        : Boolean(this.form.concept_text.trim());
    },
    conceptStatus() {
      if (this.fieldErrors.concept_text) return 'error';
      return this.conceptComplete ? 'success' : 'default';
    },
    conceptSuffixIcon() {
      if (!this.conceptComplete) return undefined;
      return {
        name: 'check-circle-filled',
        size: '20px',
        color: 'var(--success-color)',
      };
    },
    dialectRightIcon() {
      if (this.form.submitted_dialect_id) {
        return {
          name: 'check-circle-filled',
          size: '20px',
          color: 'var(--success-color)',
        };
      }
      return {
        name: 'chevron-right',
        size: '20px',
        color: 'var(--muted-color)',
      };
    },
    selectedDialectPath() {
      return findDialectPath(this.dialectTree, this.form.submitted_dialect_id);
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
        return this.optionalOpen ? ['extra'] : [];
      },
      set(value) {
        this.optionalOpen = Array.isArray(value) && value.includes('extra');
      },
    },
    packageTypeLabel() {
      return this.packageTypes.find((item) => item.value === this.label.package_type).label;
    },
    evidenceLabel() {
      return this.evidenceLevels.find((item) => item.value === this.label.evidence_level).label;
    },
    sourceTypeLabel() {
      return this.sourceTypes.find((item) => item.value === this.label.source.type)?.label || '其他';
    },
    dialectLabel() {
      const dialect = this.dialects.find((item) => item.id === this.form.submitted_dialect_id);
      return dialect ? dialect.qualified_code : (this.draftDialectName || '请选择方言点');
    },
    dialectDisplayLabel() {
      if (this.selectedDialectPath.length) {
        return this.selectedDialectPath.map((item) => item.name).join(' · ');
      }
      return this.draftDialectName || '请选择方言点';
    },
    canSubmit() {
      const hasConcept = this.mode === 'flavor'
        ? Boolean(this.targetFlavor.id)
        : this.form.concept_text.trim();
      return Boolean(
        hasConcept
        && this.form.submitted_dialect_id
        && this.audio.path
        && !this.audio.invalid,
      );
    },
    submitHint() {
      if (!this.audio.path || this.audio.invalid) return '先录一段你熟悉的家乡话。';
      if (this.mode !== 'flavor' && !this.form.concept_text.trim()) return '再填写普通话概念';
      if (!this.form.submitted_dialect_id) return '再选择方言点';
      return '内容已齐全，可以保存了';
    },
    pageTitle() {
      return this.mode === 'flavor' ? '补录乡音' : '装一罐';
    },
    isDirty() {
      return Boolean(
        this.form.concept_text
        || this.form.submitted_dialect_id
        || this.audio.path
        || this.audio.invalid
        || this.label.text_content
        || this.label.definition
        || this.label.pronunciation_text
        || this.label.source.note,
      );
    },
  },
  async onLoad(options = {}) {
    this.pageOptions = options;
    this.loadRecentDialectIds();
    await this.loadPage();
  },
  onShow() {
    this.ensureCurrentDraftOwner();
  },
  onHide() {
    this.persistDirtyDraft('page_hidden');
  },
  onUnload() {
    this.persistDirtyDraft('leave_page').finally(() => {
      releaseDraftAudioUrl(this.audio);
    });
  },
  methods: {
    recentDialectsStorageKey() {
      return `${RECENT_DIALECTS_STORAGE_KEY}:${this.draftOwnerScope}`;
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
    selectDialectShortcut(dialect) {
      if (!dialect?.id) return;
      this.form.submitted_dialect_id = Number(dialect.id);
      this.draftDialectName = this.dialectFullPath(dialect.id) || dialect.qualified_code;
      this.restoreDialectPicker(dialect.id);
      this.rememberDialect(dialect.id);
      this.dialectPickerVisible = false;
      this.clearFieldError('submitted_dialect_id');
    },
    async loadPage() {
      this.loading = true;
      this.loadError = '';
      try {
        if (!this.contextReady) {
          await this.resolveMode(this.pageOptions);
          await this.restoreDraftIfNeeded(this.pageOptions);
          this.applyEntryContext(this.pageOptions);
          this.contextReady = true;
        }
        await this.loadDialects();
        if (this.dialectLoadFailed) this.loadError = '方言点加载失败，请检查网络后重试';
      } catch (error) {
        this.loadError = '装罐表单加载失败，请重试';
      } finally {
        this.loading = false;
      }
    },
    ensureCurrentDraftOwner() {
      if (this.draftAccessBlocked) return false;
      const currentOwnerScope = getCanDraftOwnerScope();
      const previousOwnerIsUser = this.draftOwnerScope.startsWith('user:');
      const currentOwnerIsUser = currentOwnerScope.startsWith('user:');
      if (
        previousOwnerIsUser
        && currentOwnerIsUser
        && this.draftOwnerScope !== currentOwnerScope
      ) {
        this.draftAccessBlocked = true;
        releaseDraftAudioUrl(this.audio);
        uni.showToast({ title: '该草稿属于其他账号', icon: 'none' });
        goHome(true, { status: 'me' });
        return false;
      }
      if (this.draftOwnerScope.startsWith('anonymous:') && currentOwnerIsUser) {
        this.draftOwnerScope = currentOwnerScope;
      }
      return true;
    },
    async loadDialects() {
      this.dialectLoadFailed = false;
      try {
        this.dialects = await listAllDialects();
        this.dialectTree = buildDialectTree(this.dialects);
        this.restoreDialectPicker(this.form.submitted_dialect_id);
      } catch (error) {
        this.dialectLoadFailed = true;
        uni.showToast({ title: '方言点加载失败，可稍后重试', icon: 'none' });
      }
    },
    applyEntryContext(options) {
      if (!this.form.submitted_dialect_id && options.dialect) {
        this.form.submitted_dialect_id = Number(options.dialect);
      }
      if (
        this.mode === 'free'
        && !this.form.concept_text
        && options.prompt
      ) {
        this.form.concept_text = decodeURIComponent(options.prompt);
      }
    },
    async resolveMode(options) {
      if (options.flavor) {
        this.mode = 'flavor';
        this.targetFlavor = {
          id: options.flavor,
          name: decodeURIComponent(options.flavor_name || ''),
        };
        if (!this.targetFlavor.name) {
          const flavor = await getFlavor(options.flavor);
          this.targetFlavor.name = flavor.name;
        }
        this.form.concept_text = this.targetFlavor.name;
      } else if (options.mode === 'flavor') {
        this.mode = 'flavor';
      }
    },
    async restoreDraftIfNeeded(options) {
      if (options.draft) {
        await this.restoreDraft(options.draft);
        return;
      }
      const drafts = listCanDrafts();
      const latestDraft = this.targetFlavor.id
        ? drafts.find((draft) => (
          draft.mode === 'flavor'
          && String(draft.targetFlavor?.id || '') === String(this.targetFlavor.id)
        ))
        : drafts[0];
      if (!latestDraft) return;
      uni.showModal({
        title: '发现未完成草稿',
        content: '是否恢复上次没提交成功的装罐内容？',
        success: async (res) => {
          if (res.confirm) await this.restoreDraft(latestDraft.id);
        },
      });
    },
    async restoreDraft(id) {
      const draft = await getCanDraftWithAudio(id);
      if (!draft) return;
      this.draftId = draft.id;
      this.draftOwnerScope = draft.ownerScope;
      this.draftAccessBlocked = false;
      const flavorDraft = draft.mode === 'flavor' && draft.targetFlavor?.id;
      this.mode = flavorDraft ? 'flavor' : 'free';
      const restoredForm = { ...draft.form };
      if (!restoredForm.submitted_dialect_id && restoredForm.dialect) {
        restoredForm.submitted_dialect_id = restoredForm.dialect;
      }
      delete restoredForm.dialect;
      delete restoredForm.county;
      delete restoredForm.town;
      this.form = { ...initialForm(), ...restoredForm };
      const restoredLabel = { ...draft.label };
      const legacyCitation = restoredLabel.source_citation || '';
      delete restoredLabel.source_citation;
      this.label = {
        ...initialLabel(),
        ...restoredLabel,
        source: {
          ...initialLabel().source,
          ...(restoredLabel.source || {}),
          ...(legacyCitation && !restoredLabel.source ? {
            type: 'other',
            note: legacyCitation,
          } : {}),
        },
      };
      this.audio = draft.audio || this.audio;
      if (draft.audio?.invalid) {
        uni.showToast({ title: '草稿录音已失效，请重新录制', icon: 'none' });
      }
      this.draftDialectName = draft.dialectName || '';
      if (this.dialectTree.length) {
        this.restoreDialectPicker(this.form.submitted_dialect_id);
      }
      this.targetFlavor = flavorDraft
        ? draft.targetFlavor
        : { id: '', name: '' };
      this.optionalOpen = Boolean(
        this.label.text_content
        || this.label.definition
        || this.label.pronunciation_text
        || this.label.source.note,
      );
    },
    switchMode(mode) {
      this.mode = mode;
      if (mode === 'free') {
        this.targetFlavor = { id: '', name: '' };
        return;
      }
      uni.showToast({ title: '请从义项详情进入补录音', icon: 'none' });
      this.mode = 'free';
    },
    onPackageTypeChange(context = {}) {
      this.label.package_type = context.value?.[0] || this.label.package_type;
      this.packageTypePickerVisible = false;
      this.clearFieldError('package_type');
    },
    onEvidenceChange(context = {}) {
      this.label.evidence_level = Number(context.value?.[0] || this.label.evidence_level);
      this.evidencePickerVisible = false;
    },
    onSourceTypeChange(context = {}) {
      this.label.source.type = context.value?.[0] || this.label.source.type;
      this.sourceTypePickerVisible = false;
    },
    applyDialectPath(preferredIds = []) {
      const columns = [];
      const indexes = [];
      let options = this.dialectTree;
      let depth = 0;

      while (options.length) {
        columns.push(options);
        const preferredId = String(preferredIds[depth]);
        const preferredIndex = options
          .map((node) => String(node.id))
          .indexOf(preferredId);
        const index = preferredIndex >= 0 ? preferredIndex : 0;
        indexes.push(index);
        options = options[index].children;
        depth += 1;
      }

      this.dialectColumns = columns;
      this.dialectIndexes = indexes;
    },
    restoreDialectPicker(dialectId) {
      const path = findDialectPath(this.dialectTree, dialectId);
      const leaf = path[path.length - 1];
      if (leaf && !leaf.children.length) {
        this.applyDialectPath(path.map((node) => node.id));
        this.form.submitted_dialect_id = leaf.id;
        this.draftDialectName = leaf.qualified_code;
        return;
      }

      this.applyDialectPath();
      if (dialectId) {
        this.form.submitted_dialect_id = null;
        this.draftDialectName = '';
      }
    },
    onDialectColumnChange(e) {
      const columnIndex = Number(e.detail.column);
      const optionIndex = Number(e.detail.value);
      const preferredIds = this.dialectColumns
        .slice(0, columnIndex)
        .map((options, index) => options[this.dialectIndexes[index]]?.id);
      const dialect = this.dialectColumns[columnIndex]?.[optionIndex];
      if (!dialect) return;

      preferredIds.push(dialect.id);
      this.applyDialectPath(preferredIds);
      this.form.submitted_dialect_id = null;
      this.draftDialectName = '';
    },
    onDialectChange(e) {
      const selectedIndexes = Array.isArray(e.detail.value) ? e.detail.value : [];
      const selectedPath = this.dialectColumns.map(
        (options, index) => options[Number(selectedIndexes[index]) || 0],
      );
      const dialect = selectedPath[selectedPath.length - 1];
      if (!dialect || dialect.children.length) {
        this.form.submitted_dialect_id = null;
        this.draftDialectName = '';
        return;
      }

      this.dialectIndexes = selectedIndexes.map(Number);
      this.form.submitted_dialect_id = dialect.id;
      this.draftDialectName = dialect.qualified_code;
      this.clearFieldError('submitted_dialect_id');
    },
    openDialectPicker() {
      this.dialectPickerVisible = true;
    },
    onDialectCascadeChange(event = {}) {
      const detail = event.detail || event;
      const selectedOptions = detail.selectedOptions || [];
      const dialectId = detail.value;
      const selected = selectedOptions[selectedOptions.length - 1]
        || this.dialects.find((item) => String(item.id) === String(dialectId));
      if (!selected || selected.children?.length) return;

      this.form.submitted_dialect_id = Number(dialectId || selected.id);
      this.draftDialectName = selectedOptions.map((item) => item.name).filter(Boolean).join(' · ')
        || selected.qualified_code;
      this.rememberDialect(this.form.submitted_dialect_id);
      this.dialectPickerVisible = false;
      this.clearFieldError('submitted_dialect_id');
    },
    onAudioChange(audio) {
      const recordingCompleted = Boolean(audio.path && audio.path !== this.audio.path);
      if (this.audio.path && this.audio.path !== audio.path) releaseDraftAudioUrl(this.audio);
      this.audio = audio;
      this.form.duration_ms = audio.durationMs || 0;
      this.clearFieldError('audio_url');
      if (recordingCompleted) this.showPageToast('录音已完成');
      this.persistDirtyDraft('audio_changed');
    },
    showPageToast(message) {
      this.$nextTick(() => {
        if (typeof this.$refs.pageToast?.show !== 'function') return;
        this.$refs.pageToast.show({
          theme: 'success',
          message,
          duration: 1200,
          placement: 'bottom',
        });
      });
    },
    onAudioError() {
      uni.showToast({ title: '录音暂时无法使用，请重试', icon: 'none' });
    },
    clearAudio() {
      releaseDraftAudioUrl(this.audio);
      this.audio = {
        path: '',
        name: '',
        durationMs: 0,
        origin: '',
        available: true,
        invalid: false,
      };
      this.form.duration_ms = 0;
      delete this.fieldErrors.audio_url;
      if (this.draftId) {
        this.saveDraft('audio_cleared').catch(() => {
          uni.showToast({ title: '草稿保存失败，请稍后重试', icon: 'none' });
        });
      }
    },
    adoptPersistedDraftAudio(sourcePath, persistedAudio) {
      if (
        !persistedAudio?.persisted
        || !persistedAudio.available
        || this.audio.path !== sourcePath
      ) return;
      this.audio = {
        ...this.audio,
        ...persistedAudio,
        path: persistedAudio.path || this.audio.path,
      };
    },
    async saveDraft(reason) {
      if (!this.draftId) this.draftId = createCanDraftId();
      const previousSave = this.draftSavePromise || Promise.resolve();
      const saveTask = previousSave
        .catch(() => {})
        .then(async () => {
          const form = { ...this.form };
          const label = { ...this.label };
          const meta = {
            id: this.draftId,
            ownerScope: this.draftOwnerScope,
            mode: this.mode,
            targetFlavor: { ...this.targetFlavor },
            dialectName: this.dialectLabel === '请选择方言点' ? '' : this.dialectLabel,
            audio: { ...this.audio },
            reason,
          };
          let draft;
          try {
            draft = await saveCanDraft(form, label, meta);
          } catch (error) {
            this.adoptPersistedDraftAudio(meta.audio.path, error.persistedDraftAudio);
            throw error;
          }
          this.draftId = draft.id;
          this.draftOwnerScope = draft.ownerScope;
          this.adoptPersistedDraftAudio(meta.audio.path, draft.audio);
          return draft;
        });
      this.draftSavePromise = saveTask;
      return saveTask;
    },
    persistDirtyDraft(reason) {
      if (!this.submitted && !this.draftAccessBlocked && this.isDirty) {
        return this.saveDraft(reason).catch(() => {
          uni.showToast({ title: '草稿保存失败，请稍后重试', icon: 'none' });
        });
      }
      return Promise.resolve();
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    goDrafts() {
      goCanLibrary({ tab: 'drafts' });
    },
    goFlavorPicker() {
      goAtlas();
    },
    validateForm() {
      const errors = {};
      if (this.mode !== 'flavor' && !this.form.concept_text.trim()) {
        errors.concept_text = '请填写普通话概念';
      }
      if (this.mode === 'flavor' && !this.targetFlavor.id) {
        errors.concept_text = '请重新选择要补录的义项';
      }
      if (!this.form.submitted_dialect_id) {
        errors.submitted_dialect_id = '请选择方言点';
      }
      if (!this.audio.path || this.audio.invalid) {
        errors.audio_url = this.audio.invalid
          ? '草稿录音已失效，请重新录制'
          : '请先录音或上传音频';
      }
      this.fieldErrors = errors;
      if (Object.keys(errors).length) {
        uni.showToast({ title: '请检查装罐表单', icon: 'none' });
        return false;
      }
      return true;
    },
    async submit() {
      if (!this.ensureCurrentDraftOwner()) return;
      if (!this.validateForm()) return;
      if (!isLoggedIn()) {
        let draft;
        try {
          draft = await this.saveDraft('login_required');
        } catch (error) {
          uni.showToast({ title: '草稿保存失败，请稍后重试', icon: 'none' });
          return;
        }
        requireAuth('record_can', {
          page: 'can_create',
          returnRoute: ROUTES.canCreate,
          mode: this.mode,
          flavorId: this.targetFlavor.id || undefined,
          draftId: draft.id,
          ownerScope: draft.ownerScope,
        });
        return;
      }

      this.submitting = true;
      try {
        if (this.draftSavePromise) await this.draftSavePromise.catch(() => {});
        if (!this.ensureCurrentDraftOwner()) return;
        const uploaded = await uploadFile(this.audio.path);
        const canPayload = {
          ...this.form,
          audio_url: uploaded.url,
          duration_ms: uploaded.duration_ms ?? this.form.duration_ms,
        };
        const can = this.mode === 'flavor' && this.targetFlavor.id
          ? await createCanForFlavor({
            can: canPayload,
            flavorId: this.targetFlavor.id,
          })
          : await createCanWithNameplate({
            can: canPayload,
            label: this.label,
          });
        this.submitted = true;
        if (this.draftSavePromise) await this.draftSavePromise.catch(() => {});
        if (this.draftId) await removeCanDraft(this.draftId, this.draftOwnerScope);
        releaseDraftAudioUrl(this.audio);
        uni.showToast({ title: '乡音已封存', icon: 'success' });
        goCanDetail(can.id, { replace: true });
      } catch (error) {
        this.fieldErrors = canApiErrors(error);
        let draft;
        try {
          draft = await this.saveDraft(error.code || error.message || 'submit_failed');
        } catch (draftError) {
          if (error.statusCode === 401) {
            saveInterceptIntent({
              action: 'record_can',
              context: {
                page: 'can_create',
                returnRoute: ROUTES.canCreate,
                mode: this.mode,
                flavorId: this.targetFlavor.id || undefined,
                draftId: this.draftId,
                ownerScope: this.draftOwnerScope,
              },
            });
          }
          uni.showToast({ title: '提交失败，草稿也未能保存', icon: 'none' });
          return;
        }
        if (error.statusCode === 401) {
          saveInterceptIntent({
            action: 'record_can',
            context: {
              page: 'can_create',
              returnRoute: ROUTES.canCreate,
              mode: this.mode,
              flavorId: this.targetFlavor.id || undefined,
              draftId: draft.id,
              ownerScope: draft.ownerScope,
            },
          });
        }
        const title = this.audio.path && !draft.audio?.available
          ? '表单已保存，录音未能持久保留'
          : '提交失败，已保存草稿';
        uni.showToast({ title, icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--muted-color);
}

.state-card--error {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.state-title {
  color: var(--text-color);
  font-weight: 700;
}

.state-description {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.dialect-empty-state {
  margin-bottom: var(--space-3);
  background: var(--surface-subtle-color);
}

.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.target-flavor {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-weight: 700;
}

.picker-field {
  margin-bottom: var(--space-3);
}

.picker-label {
  margin-bottom: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.required-mark,
.field-error {
  color: var(--danger-color);
}

.picker-control {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-base);
  box-sizing: border-box;
}

.picker-control.placeholder {
  color: var(--muted-color);
}

.field-error {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
}

.audio-error {
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
}

.form-error {
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--danger-subtle-color);
}

.optional-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: var(--space-3) 0;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 700;
}

.form-hint {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.submit-action {
  margin: var(--space-3) 0 var(--space-5);
}

/* AudioCapture 仍是存量组件；本页按 M3 约束在页面边界内接入主题 Token。 */
:deep(.audio-capture) {
  margin: var(--space-3) 0;
}

:deep(.audio-capture .record-zone) {
  gap: var(--space-2);
  border-color: var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  color: var(--text-color);
}

:deep(.audio-capture .record-zone.recording) {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
}

:deep(.audio-capture .record-subtitle) {
  color: var(--muted-color);
}

:deep(.audio-capture .actions) {
  gap: var(--space-2);
  margin-top: var(--space-2);
}

:deep(.audio-capture .secondary-button) {
  border-color: var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-sm);
}

:deep(.audio-capture .secondary-button.danger) {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

:deep(.audio-capture .secondary-button[disabled]) {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.can-create-page {
  width: 100%;
  max-width: 960rpx;
  margin: 0 auto;
}

.page-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 960rpx;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
  box-sizing: border-box;
}

.page-state--loading {
  align-items: stretch;
  gap: var(--space-4);
}

.page-state__loading {
  align-self: center;
}

.can-create-page :deep(.audio-capture) {
  margin: 0 0 var(--space-4);
}

.can-create-page :deep(.audio-capture .record-subtitle) {
  color: var(--on-accent-color);
}

.form-sheet {
  overflow: hidden;
  margin-bottom: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.form-sheet__heading {
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.form-sheet__title {
  color: var(--accent-color);
  font-size: var(--font-size-base);
  font-weight: 500;
}

.form-sheet__subtitle {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.essential-form :deep(.t-form__item) {
  min-height: 52px;
  padding: var(--space-3) var(--space-4);
  box-sizing: border-box;
}

.essential-form :deep(.t-form__label) {
  align-self: center;
}

.essential-form :deep(.t-form__controls-content) {
  min-width: 0;
}

.essential-form :deep(.t-input),
.essential-form :deep(.t-cell) {
  min-width: 0;
}

.essential-form :deep(.t-cell) {
  padding: 0;
  background: transparent;
}

.essential-form :deep(.t-cell__title) {
  overflow: hidden;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.essential-form :deep(.t-form__item-help) {
  padding: 0 var(--space-4) var(--space-2);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}

.essential-form :deep(.t-input--success .t-input__suffix-icon),
.essential-form :deep(.concept-input--complete .t-input__suffix-icon),
.essential-form :deep(.dialect-cell--complete .t-cell__right-icon) {
  color: var(--success-color);
}

.essential-form :deep(.t-input__suffix-icon),
.essential-form :deep(.t-cell__right-icon) {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  font-size: 20px;
}

.essential-form :deep(.dialect-cell--complete .t-cell__description) {
  color: var(--text-secondary-color);
}

.dialect-error {
  margin: 0;
  padding: 0 var(--space-4) var(--space-3);
}

.dialect-empty-state {
  width: 100%;
  padding: var(--space-4);
  box-sizing: border-box;
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

.optional-collapse {
  margin-bottom: var(--space-3);
}

.optional-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4rpx;
  text-align: left;
}

.optional-summary__title {
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 500;
}

.optional-summary__description {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.optional-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.optional-group {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.optional-group__heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 700;
}

.optional-fields .picker-field {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-color);
}

.picker-control--simple {
  padding: var(--space-2) 0 0;
  border: 0;
  color: var(--text-secondary-color);
}

.submit-card {
  margin-top: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.submit-card__hint {
  display: block;
  margin-bottom: var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  text-align: center;
}

.existing-flavor-link {
  margin: var(--space-2) 0 var(--space-5);
}

.audio-error {
  margin: calc(var(--space-2) * -1) var(--space-2) var(--space-3);
}

/* #ifdef H5 */
.can-create-page,
.page-state {
  max-width: 680px;
}

:deep(.shell-topbar) {
  height: 56px;
  grid-template-columns: 32px 1fr auto;
  gap: 12px;
  padding: 0 20px;
}

:deep(.shell-back),
:deep(.shell-back-placeholder) {
  width: 32px;
}

:deep(.shell-back) {
  font-size: 32px;
}

:deep(.shell-title) {
  font-size: 18px;
}

:deep(.shell-action) {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  line-height: 34px;
}

:deep(.shell-content) {
  min-height: calc(100vh - 56px);
  padding: 20px;
}

:deep(.shell-scroll) {
  height: calc(100vh - 56px);
}

.can-create-page {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 15px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
}

.can-create-page :deep(.audio-capture) {
  padding: 28px 24px 20px;
}

.can-create-page :deep(.record-title) {
  font-size: 22px;
}

.can-create-page :deep(.record-subtitle) {
  margin-top: 6px;
  font-size: 14px;
}

.can-create-page :deep(.sound-wave) {
  gap: 5px;
  height: 48px;
  margin-top: 20px;
}

.can-create-page :deep(.sound-wave__bar) {
  width: 3px;
  height: 10px;
}

.can-create-page :deep(.sound-wave__bar:nth-child(2n)) {
  height: 20px;
}

.can-create-page :deep(.sound-wave__bar:nth-child(3n)) {
  height: 30px;
}

.can-create-page :deep(.sound-wave__bar:nth-child(5n)) {
  height: 40px;
}

.can-create-page :deep(.record-primary) {
  width: 112px;
  height: 112px;
  margin-top: 10px;
  border-width: 8px;
}

.can-create-page :deep(.record-primary__icon) {
  font-size: 28px;
}

.can-create-page :deep(.record-primary__label) {
  margin-top: 8px;
  font-size: 13px;
}

.can-create-page :deep(.record-actions) {
  min-height: 36px;
  margin-top: 4px;
}

.essential-form :deep(.t-form__label) {
  padding-right: 16px;
  font-size: 15px;
  line-height: 22px;
  word-break: keep-all;
}

.essential-form :deep(.t-form__label-text) {
  white-space: nowrap;
}

.form-sheet__heading {
  min-height: 68px;
  justify-content: center;
  padding: 16px 24px;
  box-sizing: border-box;
}

.form-sheet,
.submit-card,
.optional-group {
  border-radius: 10px;
}

.form-sheet__title {
  font-size: 16px;
}

.optional-group__heading,
.submit-card {
  padding: 16px 20px;
}

.optional-summary {
  gap: 4px;
}

.optional-summary__title {
  font-size: 16px;
  line-height: 22px;
}

.optional-summary__description {
  font-size: 13px;
  line-height: 19px;
}

.can-create-page :deep(.optional-collapse.t-collapse--card) {
  margin: 0;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

@media (max-width: 720px) {
  .can-create-page,
  .page-state {
    max-width: 100%;
  }
}
/* #endif */
</style>
