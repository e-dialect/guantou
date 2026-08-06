<template>
  <PageShell :title="pageTitle">
    <view
      v-if="!targetFlavor.id"
      class="mode-tabs"
    >
      <view
        :class="['mode-tab', mode === 'free' ? 'active' : '']"
        @tap="switchMode('free')"
      >
        自由装罐
      </view>
      <view
        :class="['mode-tab', mode === 'flavor' ? 'active' : '']"
        @tap="switchMode('flavor')"
      >
        为义项补录音
      </view>
    </view>

    <view
      v-if="mode === 'flavor'"
      class="target-flavor"
    >
      正在为「{{ targetFlavor.name || '已有义项' }}」补录一版方言
    </view>

    <uni-forms label-position="top">
      <uni-forms-item label="普通话概念">
        <input
          v-model="form.concept_text"
          class="field"
          :disabled="mode === 'flavor'"
          placeholder="例如：膝盖、祖母、走路"
          maxlength="20"
        >
      </uni-forms-item>
      <uni-forms-item label="方言点">
        <picker
          :range="dialects"
          range-key="name"
          @change="onDialectChange"
        >
          <view class="select">
            {{ dialectLabel }}
          </view>
        </picker>
      </uni-forms-item>

      <AudioCapture
        :audio="audio"
        @change="onAudioChange"
        @clear="clearAudio"
      />

      <view class="optional-head">
        <text>补充信息（选填）</text>
        <text
          class="optional-toggle"
          @tap="optionalOpen = !optionalOpen"
        >
          {{ optionalOpen ? '收起' : '展开' }}
        </text>
      </view>

      <view v-if="optionalOpen">
        <uni-forms-item label="候选写法">
          <input
            v-model="label.text_content"
            class="field"
            maxlength="10"
            placeholder="不确定正字可先空着"
          >
        </uni-forms-item>
        <uni-forms-item label="释义">
          <textarea
            v-model="label.definition"
            class="textarea"
            maxlength="50"
            placeholder="这个词是什么意思？"
          />
        </uni-forms-item>
        <uni-forms-item label="写法类型">
          <picker
            :range="packageTypes"
            range-key="label"
            @change="onPackageTypeChange"
          >
            <view class="select">
              {{ packageTypeLabel }}
            </view>
          </picker>
        </uni-forms-item>
        <uni-forms-item label="证据等级">
          <picker
            :range="evidenceLevels"
            range-key="label"
            @change="onEvidenceChange"
          >
            <view class="select">
              {{ evidenceLabel }}
            </view>
          </picker>
        </uni-forms-item>
        <uni-forms-item label="产地">
          <view class="split">
            <input
              v-model="form.county"
              class="field"
              placeholder="县区"
            >
            <input
              v-model="form.town"
              class="field"
              placeholder="乡镇/社区"
            >
          </view>
        </uni-forms-item>
        <uni-forms-item label="来源说明">
          <input
            v-model="form.source_note"
            class="field"
            maxlength="50"
            placeholder="比如：听奶奶说的"
          >
        </uni-forms-item>
      </view>
    </uni-forms>

    <view class="form-hint">
      不会写正字也没关系，先录下来最重要。
    </view>

    <button
      class="primary-button"
      :disabled="submitting || !canSubmit"
      @tap="submit"
    >
      {{ submitting ? '提交中...' : '封存这罐乡音' }}
    </button>
  </PageShell>
</template>

<script>
import AudioCapture from '@/components/AudioCapture.vue';
import PageShell from '@/components/PageShell.vue';
import { uploadFile } from '@/services/file';
import {
  createCanForFlavor,
  createCanWithNameplate,
  getFlavor,
  listDialects,
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

function initialForm() {
  return {
    audio_url: '',
    concept_text: '',
    dialect: null,
    county: '',
    town: '',
    source_note: '',
    duration_ms: 0,
  };
}

function initialLabel() {
  return {
    text_content: '',
    definition: '',
    package_type: 'uncertain',
    evidence_level: 1,
    source_citation: '',
  };
}

export default {
  components: {
    AudioCapture,
    PageShell,
  },
  data() {
    return {
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
    };
  },
  computed: {
    packageTypeLabel() {
      return this.packageTypes.find((item) => item.value === this.label.package_type).label;
    },
    evidenceLabel() {
      return this.evidenceLevels.find((item) => item.value === this.label.evidence_level).label;
    },
    dialectLabel() {
      const dialect = this.dialects.find((item) => item.id === this.form.dialect);
      return dialect ? dialect.name : (this.draftDialectName || '请选择方言点');
    },
    canSubmit() {
      const hasConcept = this.mode === 'flavor'
        ? Boolean(this.targetFlavor.id)
        : this.form.concept_text.trim();
      return Boolean(
        hasConcept
        && this.form.dialect
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
        || this.form.dialect
        || this.audio.path
        || this.audio.invalid
        || this.label.text_content
        || this.label.definition
        || this.form.source_note,
      );
    },
  },
  async onLoad(options = {}) {
    await this.resolveMode(options);
    await this.restoreDraftIfNeeded(options);
    await this.loadDialects();
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
        uni.reLaunch({ url: '/pages/index?status=me' });
        return false;
      }
      if (this.draftOwnerScope.startsWith('anonymous:') && currentOwnerIsUser) {
        this.draftOwnerScope = currentOwnerScope;
      }
      return true;
    },
    async loadDialects() {
      try {
        const res = await listDialects();
        this.dialects = res.results || res;
      } catch (error) {
        uni.showToast({ title: '方言点加载失败，可稍后重试', icon: 'none' });
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
      this.form = { ...initialForm(), ...draft.form };
      this.label = { ...initialLabel(), ...draft.label };
      this.audio = draft.audio || this.audio;
      if (draft.audio?.invalid) {
        uni.showToast({ title: '草稿录音已失效，请重新录制', icon: 'none' });
      }
      this.draftDialectName = draft.dialectName || '';
      this.targetFlavor = flavorDraft
        ? draft.targetFlavor
        : { id: '', name: '' };
      this.optionalOpen = Boolean(
        this.label.text_content || this.label.definition || this.form.source_note,
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
    },
    onEvidenceChange(e) {
      this.label.evidence_level = this.evidenceLevels[e.detail.value].value;
    },
    onDialectChange(e) {
      const dialect = this.dialects[e.detail.value];
      this.form.dialect = dialect.id;
      this.draftDialectName = dialect.name;
      this.form.county = this.form.county || dialect.county || '';
      this.form.town = this.form.town || dialect.town || '';
    },
    onAudioChange(audio) {
      if (this.audio.path && this.audio.path !== audio.path) releaseDraftAudioUrl(this.audio);
      this.audio = audio;
      this.form.duration_ms = audio.durationMs || 0;
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
    validateForm() {
      if (this.mode !== 'flavor' && !this.form.concept_text.trim()) {
        uni.showToast({ title: '先写一个普通话概念', icon: 'none' });
        return false;
      }
      if (this.mode === 'flavor' && !this.targetFlavor.id) {
        uni.showToast({ title: '请重新选择要补录的义项', icon: 'none' });
        return false;
      }
      if (!this.form.dialect) {
        uni.showToast({ title: '请选择方言点', icon: 'none' });
        return false;
      }
      if (!this.audio.path || this.audio.invalid) {
        const title = this.audio.invalid
          ? '草稿录音已失效，请重新录制'
          : '请先录音或上传音频';
        uni.showToast({ title, icon: 'none' });
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
          returnRoute: '/pages/cans/create',
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
        uni.redirectTo({ url: `/pages/cans/details?id=${can.id}` });
      } catch (error) {
        let draft;
        try {
          draft = await this.saveDraft(error.code || error.message || 'submit_failed');
        } catch (draftError) {
          if (error.statusCode === 401) {
            saveInterceptIntent({
              action: 'record_can',
              context: {
                page: 'can_create',
                returnRoute: '/pages/cans/create',
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
              returnRoute: '/pages/cans/create',
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
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.topbar {
  height: 96rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background: #ffffff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 56rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.content {
  height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.mode-tab {
  text-align: center;
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  padding: 18rpx 12rpx;
  color: #526158;
}

.mode-tab.active {
  background: #1f5c43;
  border-color: #1f5c43;
  color: #fff;
  font-weight: 700;
}

.field,
.textarea,
.select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  background: #fff;
  padding: 22rpx;
  font-size: 30rpx;
}

.target-flavor {
  background: #e8f1eb;
  border: 1px solid #cbdcca;
  border-radius: 12rpx;
  color: #1f5c43;
  padding: 22rpx;
  margin-bottom: 24rpx;
  font-weight: 700;
}

.optional-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  padding: 22rpx;
  margin-bottom: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.optional-toggle {
  color: #1f5c43;
  font-size: 26rpx;
  font-weight: 500;
}

.form-hint {
  color: #6a766e;
  font-size: 26rpx;
}

.textarea {
  min-height: 150rpx;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.primary-button {
  margin: 24rpx 0 64rpx;
  background: #1f5c43;
  color: white;
  border-radius: 12rpx;
}

.primary-button[disabled] {
  background: #aeb9b1;
}
</style>
