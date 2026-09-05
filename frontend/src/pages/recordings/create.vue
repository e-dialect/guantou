<template>
  <AppShell
    title="录制乡音"
    active="record"
  >
    <view class="record-page">
      <view class="record-page__intro">
        <text class="record-page__title">
          会说就能贡献
        </text>
        <text class="record-page__copy">
          最低只需一段录音、使用地区和大意。不会写汉字、不会 IPA，都可以先留空。
        </text>
      </view>

      <view
        v-if="!capabilityAvailable"
        class="record-section"
      >
        录音提交正在维护。你可以稍后再试；应用不会读取或保存设备位置。
      </view>

      <BaseForm
        v-else
        ref="form"
        :data="form"
        :rules="rules"
      >
        <view class="record-section">
          <view class="record-section__heading">
            1 · 录音
          </view>
          <AudioCapture
            :audio="audio"
            :invalid="Boolean(fieldErrors.audio_url)"
            @change="onAudioChange"
            @clear="clearAudio"
            @error="onAudioError"
          />
          <view
            v-if="fieldErrors.audio_url"
            class="field-error"
          >
            {{ fieldErrors.audio_url }}
          </view>
        </view>

        <view class="record-section">
          <view class="record-section__heading">
            2 · 在哪里这样说
          </view>
          <t-cell
            title="使用地区"
            required
            :note="selectedDialectLabel"
            arrow
            hover
            @click="dialectPickerVisible = true"
          />
          <view
            v-if="fieldErrors.usage_dialect_id"
            class="field-error"
          >
            {{ fieldErrors.usage_dialect_id }}
          </view>
          <view class="record-section__help">
            不知道更细的地点时，可以停在自己确定的上一级范围。
          </view>
        </view>

        <view class="record-section">
          <view class="record-section__heading">
            3 · 大概是什么意思
          </view>
          <BaseField
            v-model="form.original_gloss"
            name="original_gloss"
            type="textarea"
            label="用你自己的话说明"
            required
            :maxlength="300"
            placeholder="例如：表示害怕的意思；看到危险时会说"
            :error="fieldErrors.original_gloss"
            @change="clearFieldError('original_gloss')"
          />
        </view>

        <t-collapse
          v-model:value="optionalSections"
          theme="card"
        >
          <t-collapse-panel
            value="optional"
            header="我还知道一些（可选）"
            header-right-content="写法、读音、已有词条、来源"
          >
            <view class="optional-fields">
              <BaseField
                v-model="form.original_writing"
                name="original_writing"
                label="我猜的写法"
                :maxlength="160"
                placeholder="不确定也可以写，系统会标成待考"
              />
              <BaseField
                v-model="form.original_pronunciation"
                name="original_pronunciation"
                label="我熟悉的读音记法"
                :maxlength="240"
                placeholder="IPA、罗马字或自己的记法都可以"
              />

              <view class="entry-linker">
                <view class="entry-linker__heading">
                  关联已有词条
                </view>
                <view
                  v-if="selectedEntry"
                  class="selected-entry"
                >
                  <view>
                    <view class="selected-entry__title">
                      {{ entryTitle(selectedEntry) }}
                    </view>
                    <view class="selected-entry__summary">
                      {{ selectedEntry.summary }}
                    </view>
                  </view>
                  <BaseButton
                    size="small"
                    variant="ghost"
                    text="取消关联"
                    @click="clearEntry"
                  />
                </view>
                <template v-else>
                  <BaseField
                    v-model="entryKeyword"
                    name="entry_keyword"
                    label="查找词条"
                    placeholder="按写法或大意搜索"
                    @confirm="searchEntries"
                  />
                  <BaseButton
                    size="small"
                    variant="ghost"
                    :loading="entrySearching"
                    text="查找可关联词条"
                    @click="searchEntries"
                  />
                  <view
                    v-for="entry in entryCandidates"
                    :key="entry.id"
                    class="entry-candidate"
                    role="button"
                    :aria-label="`关联词条：${entryTitle(entry)}`"
                    @tap="selectEntry(entry)"
                  >
                    <view class="entry-candidate__title">
                      {{ entryTitle(entry) }}
                    </view>
                    <view class="entry-candidate__summary">
                      {{ entry.summary || '大意待补充' }}
                    </view>
                    <view class="entry-candidate__meta">
                      {{ dialectLabel(entry.usage_dialect) }} · {{ entry.recording_count }} 段录音
                    </view>
                  </view>
                </template>
              </view>

              <BaseField
                v-model="form.citation"
                name="citation"
                label="来源补充"
                :maxlength="500"
                placeholder="谁教你这样说，或记录在哪本资料里"
              />
              <BaseField
                v-model="form.rights_statement"
                name="rights_statement"
                type="textarea"
                label="录音授权说明"
                :maxlength="300"
                placeholder="例如：允许乡声集盒展示与非商业研究引用，请注明录制者"
              />
            </view>
          </t-collapse-panel>
        </t-collapse>

        <view class="record-submit">
          <view class="record-submit__note">
            提交后先成为可追溯初稿，写法和专业读音可以由你或整理员继续补充。
          </view>
          <BaseButton
            block
            size="large"
            :loading="submitting"
            :disabled="submitting"
            text="保存这段乡音"
            @click="submit"
          />
        </view>
      </BaseForm>

      <DialectSelector
        v-if="capabilityAvailable"
        v-model:visible="dialectPickerVisible"
        :value="form.usage_dialect_id"
        :dialects="dialects"
        :default-dialect="primaryDialect"
        :owner-scope="dialectOwnerScope"
        title="选择使用地区"
        @change="onDialectChange"
      />
    </view>
  </AppShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import AppShell from '@/components/AppShell.vue';
import AudioCapture from '@/components/AudioCapture.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createRecording,
  dialectLabel,
  entryTitle,
  getEntry,
  listEntries,
  pageResults,
  primaryEntryLink,
} from '@/services/entryRecording';
import { uploadFile } from '@/services/file';
import { notify, notifySuccess } from '@/services/feedback';
import { listAllDialects } from '@/services/guantou';
import { goEntryDetail, goHome } from '@/services/navigation';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

function emptyAudio() {
  return {
    path: '', name: '', durationMs: 0, origin: '', invalid: false,
  };
}

export default {
  components: {
    AppShell,
    AudioCapture,
    BaseButton,
    BaseField,
    BaseForm,
    DialectSelector,
    TCell,
    TCollapse,
    TCollapsePanel,
  },
  data() {
    return {
      form: {
        usage_dialect_id: '',
        original_gloss: '',
        original_writing: '',
        original_pronunciation: '',
        citation: '',
        rights_statement: '',
      },
      rules: {
        original_gloss: [{ required: true, message: '请简单说明录音的大意' }],
      },
      audio: emptyAudio(),
      fieldErrors: {},
      optionalSections: [],
      dialects: [],
      dialectPickerVisible: false,
      entryKeyword: '',
      entryCandidates: [],
      entrySearching: false,
      selectedEntry: null,
      submitting: false,
      capabilityAvailable: true,
    };
  },
  computed: {
    primaryDialect() {
      return getApp()?.globalData?.userInfo?.primary_dialect || null;
    },
    dialectOwnerScope() {
      return getApp()?.globalData?.userInfo?.id || 'guest';
    },
    selectedDialectLabel() {
      const dialect = this.dialects.find(
        (item) => String(item.id) === String(this.form.usage_dialect_id),
      );
      return dialect ? dialectBreadcrumb(dialect, this.dialects) : '请选择已知范围';
    },
  },
  async onLoad(options = {}) {
    if (!requireAuth('record_recording', { page: 'record' })) return;
    this.capabilityAvailable = ensureCapability(CAPABILITIES.RECORDING, 'record');
    if (!this.capabilityAvailable) return;
    await this.loadDialects();
    if (options.entry_id) await this.loadEntry(options.entry_id);
  },
  methods: {
    dialectLabel,
    entryTitle,
    async loadDialects() {
      try {
        this.dialects = await listAllDialects();
        if (this.primaryDialect?.id) this.form.usage_dialect_id = this.primaryDialect.id;
      } catch (error) {
        this.dialects = [];
      }
    },
    async loadEntry(id) {
      try {
        this.selectedEntry = await getEntry(id);
        this.optionalSections = ['optional'];
      } catch (error) {
        notify({ title: '原词条暂时无法读取', icon: 'none' });
      }
    },
    onAudioChange(audio) {
      this.audio = { ...emptyAudio(), ...audio };
      this.clearFieldError('audio_url');
    },
    clearAudio() {
      this.audio = emptyAudio();
    },
    onAudioError(error) {
      notify({ title: error?.message || error?.errMsg || '录音失败，请重试', icon: 'none' });
    },
    onDialectChange(context = {}) {
      this.form.usage_dialect_id = context.value || '';
      this.clearFieldError('usage_dialect_id');
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    async searchEntries() {
      const keyword = String(this.entryKeyword || '').trim();
      if (!keyword) {
        notify({ title: '先输入写法或大意', icon: 'none' });
        return;
      }
      this.entrySearching = true;
      try {
        const response = await listEntries({ search: keyword, page_size: 6 });
        this.entryCandidates = pageResults(response);
      } catch (error) {
        notify({ title: '词条查找失败', icon: 'none' });
      } finally {
        this.entrySearching = false;
      }
    },
    selectEntry(entry) {
      this.selectedEntry = entry;
      this.entryCandidates = [];
    },
    clearEntry() {
      this.selectedEntry = null;
      this.entryCandidates = [];
    },
    async validateForm() {
      const baseValid = await this.$refs.form.validate();
      const errors = {};
      if (!this.audio.path || this.audio.invalid) errors.audio_url = '请先录音或选择一段音频';
      if (!this.form.usage_dialect_id) errors.usage_dialect_id = '请选择这段话的使用地区';
      if (!String(this.form.original_gloss || '').trim()) {
        errors.original_gloss = '请用自己的话简单说明意思';
      }
      this.fieldErrors = errors;
      if (baseValid !== true || Object.keys(errors).length) {
        notify({ title: '还差几项必要信息', icon: 'none' });
        return false;
      }
      return true;
    },
    async submit() {
      if (this.submitting || !await this.validateForm()) return;
      this.submitting = true;
      try {
        const uploaded = await uploadFile(this.audio.path);
        const payload = {
          audio_url: uploaded.url,
          usage_dialect_id: Number(this.form.usage_dialect_id),
          recording_type: 'word',
          original_gloss: String(this.form.original_gloss).trim(),
          duration_ms: Number(uploaded.duration_ms ?? this.audio.durationMs ?? 0),
          rights_statement: String(this.form.rights_statement || '').trim(),
          original_writing: String(this.form.original_writing || '').trim(),
          original_pronunciation: String(this.form.original_pronunciation || '').trim(),
          citation: String(this.form.citation || '').trim(),
        };
        if (this.selectedEntry?.id) payload.primary_entry_id = this.selectedEntry.id;
        const recording = await createRecording(payload);
        trackProductEvent(PRODUCT_EVENTS.RECORDING_SUBMIT, {
          surface: 'record',
          result: 'success',
          metadata: { has_linked_entry: Boolean(this.selectedEntry?.id) },
        });
        notifySuccess({ title: '乡音已保存为可追溯初稿' });
        const entryId = primaryEntryLink(recording)?.entry?.id;
        if (entryId) goEntryDetail(entryId, { replace: true });
        else goHome(true);
      } catch (error) {
        trackProductEvent(PRODUCT_EVENTS.RECORDING_SUBMIT, {
          surface: 'record',
          result: 'error',
          metadata: { has_linked_entry: Boolean(this.selectedEntry?.id) },
        });
        this.fieldErrors = {
          ...this.fieldErrors,
          ...(error?.data || {}),
        };
        notify({ title: error?.message || '保存失败，录音仍保留在本页', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.record-page,
.optional-fields {
  display: grid;
  gap: 24rpx;
}

.record-page__intro,
.record-section,
.record-submit,
.entry-linker {
  padding: 28rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.record-page__intro {
  display: grid;
  gap: 10rpx;
}

.record-page__title {
  font-size: 38rpx;
  font-weight: 800;
}

.record-page__copy,
.record-section__help,
.record-submit__note,
.selected-entry__summary,
.entry-candidate__summary,
.entry-candidate__meta {
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.record-section {
  display: grid;
  gap: 18rpx;
}

.record-section__heading,
.entry-linker__heading,
.selected-entry__title,
.entry-candidate__title {
  font-weight: 800;
}

.field-error {
  color: var(--danger-color);
  font-size: 23rpx;
}

.entry-linker,
.record-submit {
  display: grid;
  gap: 18rpx;
}

.selected-entry {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18rpx;
}

.entry-candidate {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  border: 1rpx solid var(--border-color);
}

.entry-candidate__summary,
.entry-candidate__meta {
  margin-top: 8rpx;
  font-size: 23rpx;
}
</style>
