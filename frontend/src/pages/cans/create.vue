<template>
  <PageShell :title="pageTitle">
    <view
      v-if="loading"
      class="state-card"
    >
      正在准备装罐表单…
    </view>
    <view
      v-else-if="loadError"
      class="state-card state-card--error"
    >
      <text>{{ loadError }}</text>
      <BaseButton
        variant="ghost"
        size="small"
        text="重试"
        @click="loadPage"
      />
    </view>
    <template v-else>
      <view
        v-if="!targetFlavor.id"
        class="mode-tabs"
      >
        <BaseButton
          :variant="mode === 'free' ? 'primary' : 'ghost'"
          text="自由装罐"
          @click="switchMode('free')"
        />
        <BaseButton
          :variant="mode === 'flavor' ? 'primary' : 'ghost'"
          text="为义项补录音"
          @click="switchMode('flavor')"
        />
      </view>

      <view
        v-if="mode === 'flavor'"
        class="target-flavor"
      >
        正在为「{{ targetFlavor.name || '已有义项' }}」补录一版方言
      </view>

      <BaseField
        v-model="form.concept_text"
        label="普通话概念"
        required
        :error="fieldErrors.concept_text"
        :disabled="mode === 'flavor'"
        placeholder="例如：膝盖、祖母、走路"
        :maxlength="20"
        @input="clearFieldError('concept_text')"
      />

      <view
        v-if="!dialects.length"
        class="state-card dialect-empty-state"
      >
        <view>
          <view class="state-title">
            暂无可用方言点
          </view>
          <view class="state-description">
            请先初始化方言资料，再回来完成装罐。
          </view>
        </view>
        <BaseButton
          variant="ghost"
          size="small"
          text="重新加载"
          @click="loadPage"
        />
      </view>
      <view
        v-else
        class="picker-field"
      >
        <view class="picker-label">
          方言点 <text class="required-mark">
            *
          </text>
        </view>
        <picker
          :range="dialects"
          range-key="qualified_code"
          @change="onDialectChange"
        >
          <view :class="['picker-control', { placeholder: !form.submitted_dialect_id }]">
            {{ dialectLabel }}
          </view>
        </picker>
        <view
          v-if="fieldErrors.submitted_dialect_id"
          class="field-error"
        >
          {{ fieldErrors.submitted_dialect_id }}
        </view>
      </view>

      <AudioCapture
        :audio="audio"
        @change="onAudioChange"
        @clear="clearAudio"
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

      <view class="optional-head">
        <text>补充信息（选填）</text>
        <BaseButton
          variant="ghost"
          size="small"
          :text="optionalOpen ? '收起' : '展开'"
          @click="optionalOpen = !optionalOpen"
        />
      </view>

      <view v-if="optionalOpen">
        <BaseField
          v-model="label.text_content"
          label="候选写法"
          :error="fieldErrors.text_content"
          :maxlength="10"
          placeholder="不确定正字可先空着"
          @input="clearFieldError('text_content')"
        />
        <BaseField
          v-model="label.definition"
          label="释义"
          type="textarea"
          :error="fieldErrors.definition"
          :maxlength="50"
          placeholder="这个词是什么意思？"
          @input="clearFieldError('definition')"
        />
        <BaseField
          v-model="label.pronunciation_text"
          label="原样读音"
          :error="fieldErrors.pronunciation_text"
          :maxlength="40"
          placeholder="IPA、罗马字或其他原样转写"
          @input="clearFieldError('pronunciation_text')"
        />

        <view class="picker-field">
          <view class="picker-label">
            写法类型
          </view>
          <picker
            :range="packageTypes"
            range-key="label"
            @change="onPackageTypeChange"
          >
            <view class="picker-control">
              {{ packageTypeLabel }}
            </view>
          </picker>
        </view>
        <view class="picker-field">
          <view class="picker-label">
            证据等级
          </view>
          <picker
            :range="evidenceLevels"
            range-key="label"
            @change="onEvidenceChange"
          >
            <view class="picker-control">
              {{ evidenceLabel }}
            </view>
          </picker>
        </view>
        <view class="picker-field">
          <view class="picker-label">
            资料来源类型
          </view>
          <picker
            :range="sourceTypes"
            range-key="label"
            @change="onSourceTypeChange"
          >
            <view class="picker-control">
              {{ sourceTypeLabel }}
            </view>
          </picker>
        </view>

        <BaseField
          v-model="label.source.attributed_to"
          label="资料责任者"
          :error="fieldErrors.attributed_to"
          :maxlength="50"
          placeholder="讲述人、作者、编者或采集者"
          @input="clearFieldError('attributed_to')"
        />
        <view class="split">
          <BaseField
            v-model="label.source.title"
            label="出处标题"
            :error="fieldErrors.title"
            placeholder="书名、文章名或档案名"
            @input="clearFieldError('title')"
          />
          <BaseField
            v-model="label.source.locator"
            label="出处位置"
            :error="fieldErrors.locator"
            placeholder="页码、条目号或录音编号"
            @input="clearFieldError('locator')"
          />
        </view>
        <BaseField
          v-model="label.source.note"
          label="来源说明"
          :error="fieldErrors.note"
          :maxlength="50"
          placeholder="比如：听奶奶说的"
          @input="clearFieldError('note')"
        />
        <BaseField
          v-model="form.source_note"
          label="录音采集备注"
          :error="fieldErrors.source_note"
          :maxlength="80"
          placeholder="录音环境、设备或采集上下文（选填）"
          @input="clearFieldError('source_note')"
        />
      </view>

      <view class="form-hint">
        不会写正字也没关系，先录下来最重要。
      </view>

      <view class="submit-action">
        <BaseButton
          block
          :loading="submitting"
          :disabled="submitting || !dialects.length"
          :text="submitting ? '提交中…' : '封存这罐乡音'"
          @click="submit"
        />
      </view>
    </template>
  </PageShell>
</template>

<script>
import AudioCapture from '@/components/AudioCapture.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import PageShell from '@/components/PageShell.vue';
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
import { goCanDetail, goHome, ROUTES } from '@/services/navigation';

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

export default {
  components: {
    AudioCapture,
    BaseButton,
    BaseField,
    PageShell,
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
      draftDialectName: '',
      dialects: [],
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
      sourceTypes: [
        { label: '创作者自述', value: 'creator' },
        { label: '口述', value: 'oral' },
        { label: '田野记录', value: 'fieldwork' },
        { label: '书籍', value: 'book' },
        { label: '论文/文章', value: 'article' },
        { label: '档案', value: 'archive' },
        { label: '网页', value: 'web' },
        { label: '其他', value: 'other' },
      ],
    };
  },
  computed: {
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
    onPackageTypeChange(e) {
      this.label.package_type = this.packageTypes[e.detail.value].value;
      this.clearFieldError('package_type');
    },
    onEvidenceChange(e) {
      this.label.evidence_level = this.evidenceLevels[e.detail.value].value;
    },
    onSourceTypeChange(e) {
      this.label.source.type = this.sourceTypes[e.detail.value].value;
    },
    onDialectChange(e) {
      const dialect = this.dialects[e.detail.value];
      this.form.submitted_dialect_id = dialect.id;
      this.draftDialectName = dialect.qualified_code;
      this.clearFieldError('submitted_dialect_id');
    },
    onAudioChange(audio) {
      if (this.audio.path && this.audio.path !== audio.path) releaseDraftAudioUrl(this.audio);
      this.audio = audio;
      this.form.duration_ms = audio.durationMs || 0;
      this.clearFieldError('audio_url');
      this.persistDirtyDraft('audio_changed');
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
</style>
