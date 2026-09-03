<template>
  <PageShell
    title="发表立论"
    :scroll="false"
  >
    <view class="create-page">
      <view class="create-page__notice">
        <view class="create-page__notice-title">
          一张新铭牌，一种可追溯的说法
        </view>
        <view class="create-page__notice-copy">
          你的立论会与现有铭牌并列呈现，不会覆盖或修改别人的记录。
        </view>
      </view>

      <BaseLoading
        v-if="loading"
        text="正在准备铭牌表单…"
      />
      <EmptyState
        v-else-if="loadError"
        :title="loadError"
        action-text="重试"
        @action="loadContext"
      />
      <BaseForm
        v-else-if="contextLoaded"
        ref="form"
        :data="form"
        :rules="rules"
      >
        <view
          v-if="reference"
          class="reference-card"
        >
          <view class="reference-card__label">
            参考中的铭牌
          </view>
          <view class="reference-card__writing">
            {{ reference.display_text }}
          </view>
          <view class="reference-card__copy">
            {{ reference.definition || '暂无释义' }}
          </view>
        </view>

        <view class="form-sheet">
          <view class="form-sheet__title">
            你的主张
          </view>
          <BaseField
            v-model="form.text_content"
            name="text_content"
            label="写作"
            placeholder="例如：刣 / 杀"
            :maxlength="160"
            :disabled="submitting || submitted"
            help="写法或实际读音至少填写一项"
            @change="clearClaimValidation"
          />
          <BaseField
            v-model="form.pronunciation_text"
            name="pronunciation_text"
            label="实际读音"
            placeholder="可填写来源原样罗马字或 IPA"
            :maxlength="160"
            :disabled="submitting || submitted"
            @change="clearClaimValidation"
          />
          <BaseField
            v-model="form.definition"
            name="definition"
            type="textarea"
            label="释义"
            placeholder="说明这个词在本地方言里的意思和用法"
            :maxlength="1000"
            :disabled="submitting || submitted"
            indicator
            autosize
          />
        </view>

        <view class="form-sheet">
          <view class="form-sheet__title">
            方言与依据
          </view>
          <BaseField
            name="dialect_id"
            label="方言点"
          >
            <t-cell
              class="dialect-cell"
              :class="{ 'dialect-cell--complete': selectedDialect }"
              :title="selectedDialect ? dialectFullPath(selectedDialect.id) : '选择省、市、区县'"
              :right-icon="dialectRightIcon"
              :bordered="false"
              hover
              @click="openDialectPicker"
            />
            <view
              v-if="!dialects.length"
              class="form-sheet__hint"
            >
              暂无可选方言点，可继续发表铭牌。
            </view>
          </BaseField>
          <view class="picker-field">
            <view class="picker-label">
              资料来源类型
            </view>
            <t-cell
              class="source-cell"
              :title="sourceLabels[sourceIndex]"
              arrow
              :bordered="false"
              hover
              @click="openSourcePicker"
            />
          </view>
          <BaseField
            v-model="form.source.title"
            name="source.title"
            label="来源名称"
            placeholder="书名、文章名或资料名称（选填）"
            :disabled="submitting || submitted"
          />
          <BaseField
            v-model="form.source.attributed_to"
            name="source.attributed_to"
            label="提供者"
            placeholder="口述者、作者或整理者（选填）"
            :disabled="submitting || submitted"
          />
          <BaseField
            v-model="form.source.locator"
            name="source.locator"
            label="定位"
            placeholder="页码、条目号等（选填）"
            :disabled="submitting || submitted"
          />
          <BaseField
            v-model="form.source.note"
            name="source.note"
            type="textarea"
            label="补充说明"
            placeholder="记录判断依据，方便后来者复核"
            autosize
            :disabled="submitting || submitted"
          />
        </view>

        <view
          v-if="submitError"
          class="submit-error"
        >
          {{ submitError }}
        </view>
        <BaseButton
          block
          size="large"
          :loading="submitting"
          :disabled="submitting || submitted"
          @click="submit"
        >
          {{ submitting ? '发表中…' : '发表这张铭牌' }}
        </BaseButton>
      </BaseForm>

      <t-cascader
        :visible="dialectPickerVisible"
        :value="selectedDialect?.id || undefined"
        title="选择方言点"
        placeholder="请选择"
        theme="tab"
        filterable
        filter-placeholder="搜索名称或方言点编码"
        :filter="filterDialectOption"
        :keys="{ value: 'id', label: 'name', children: 'children' }"
        :options="dialectCascadeOptions"
        @change="chooseDialect"
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
              <BaseButton
                size="small"
                variant="ghost"
                @click="chooseDialect({ value: primaryDialect.id })"
              >
                {{ dialectFullPath(primaryDialect.id) }}
              </BaseButton>
            </view>
            <view
              v-if="recentDialects.length"
              class="dialect-shortcut-group"
            >
              <text class="dialect-shortcut-group__label">
                最近使用
              </text>
              <view class="dialect-shortcut-list">
                <BaseButton
                  v-for="dialect in recentDialects"
                  :key="dialect.id"
                  size="small"
                  variant="ghost"
                  @click="chooseDialect({ value: dialect.id })"
                >
                  {{ dialectFullPath(dialect.id) }}
                </BaseButton>
              </view>
            </view>
          </view>
        </template>
      </t-cascader>
      <t-picker
        :visible="sourcePickerVisible"
        :value="[sourceOptions[sourceIndex].value]"
        title="选择资料来源类型"
        @change="chooseSource"
        @close="sourcePickerVisible = false"
      >
        <t-picker-item :options="sourceOptions" />
      </t-picker>
    </view>
  </PageShell>
</template>

<script>
import TCascader from '@tdesign/uniapp/cascader/cascader.vue';
import { buildDialectTree, findDialectPath } from '@/utils/dialectTree';
import SOURCE_OPTIONS from '@/utils/sourceOptions';
import { getCanDraftOwnerScope } from '@/services/canDrafts';
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import {
  createNameplate,
  getNameplate,
  listAllDialects,
} from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import { notifySuccess } from '@/services/feedback';
import { goHome, goNameplateDetail } from '@/services/navigation';

export default {
  components: {
    PageShell,
    BaseButton,
    BaseField,
    BaseForm,
    BaseLoading,
    EmptyState,
    TCell,
    TCascader,
    TPicker,
    TPickerItem,
  },
  data() {
    return {
      canId: null,
      referenceId: null,
      reference: null,
      contextLoaded: false,
      loading: true,
      loadError: '',
      dialects: [],
      dialectIndex: 0,
      recentDialectIds: [],
      dialectPickerVisible: false,
      sourceIndex: 0,
      sourceOptions: SOURCE_OPTIONS,
      sourcePickerVisible: false,
      submitting: false,
      submitted: false,
      submitError: '',
      form: {
        text_content: '',
        pronunciation_text: '',
        definition: '',
        source: {
          title: '', attributed_to: '', locator: '', note: '',
        },
      },
    };
  },
  computed: {
    rules() {
      const rule = {
        validator: () => (
          String(this.form.text_content || '').trim()
          || String(this.form.pronunciation_text || '').trim()
            ? true
            : { result: false, message: '写法或实际读音至少填写一项', type: 'error' }
        ),
      };
      return { text_content: [rule], pronunciation_text: [rule] };
    },
    dialectTree() {
      return buildDialectTree(this.dialects);
    },
    dialectCascadeOptions() {
      const normalize = (nodes) => nodes.map((node) => {
        const result = { ...node };
        if (node.children.length) result.children = normalize(node.children);
        else delete result.children;
        return result;
      });
      return normalize(this.dialectTree);
    },
    dialectRightIcon() {
      return {
        name: this.selectedDialect ? 'check-circle-filled' : 'chevron-right',
        size: '20px',
        color: this.selectedDialect ? 'var(--success-color)' : 'var(--muted-color)',
      };
    },
    primaryDialect() {
      const app = typeof getApp === 'function' ? getApp() : null;
      const primary = app?.globalData?.userInfo?.primary_dialect;
      return this.dialects.find((item) => String(item.id) === String(primary?.id)) || null;
    },
    recentDialects() {
      return this.recentDialectIds
        .map((id) => this.dialects.find((item) => String(item.id) === String(id)))
        .filter(Boolean)
        .filter((item) => String(item.id) !== String(this.primaryDialect?.id));
    },
    selectedDialect() {
      return this.dialects[this.dialectIndex] || null;
    },
    sourceLabels() {
      return SOURCE_OPTIONS.map((item) => item.label);
    },
  },
  async onLoad(options = {}) {
    this.canId = Number(options.can_id);
    this.referenceId = options.reference_id ? Number(options.reference_id) : null;
    if (!this.canId || !requireAuth('nameplate_create', {
      canId: this.canId,
      nameplateId: this.referenceId,
    })) {
      if (!this.canId) goHome(true);
      return;
    }
    this.loadRecentDialectIds();
    await this.loadContext();
  },
  methods: {
    async loadContext() {
      if (this.submitting || this.submitted) return;
      this.loading = true;
      this.loadError = '';
      this.contextLoaded = false;
      try {
        const [dialects, reference] = await Promise.all([
          listAllDialects(),
          this.referenceId ? getNameplate(this.referenceId) : Promise.resolve(null),
        ]);
        this.dialects = dialects;
        this.reference = reference;
        const referenceDialectId = reference?.dialect?.id;
        const matchedIndex = this.dialects.findIndex((item) => item.id === referenceDialectId);
        this.dialectIndex = matchedIndex >= 0 ? matchedIndex : 0;
        this.contextLoaded = true;
      } catch (error) {
        // The request layer already routes the failure toast through feedback.
        this.loadError = error.message || '铭牌表单加载失败，请重试';
      } finally {
        this.loading = false;
      }
    },
    clearClaimValidation() {
      this.$refs.form?.clearValidate(['text_content', 'pronunciation_text']);
    },
    openDialectPicker() {
      if (this.submitting || this.submitted || !this.dialects.length) return;
      this.dialectPickerVisible = true;
    },
    openSourcePicker() {
      if (this.submitting || this.submitted) return;
      this.sourcePickerVisible = true;
    },
    dialectFullPath(dialectId) {
      return findDialectPath(this.dialectTree, dialectId).map((item) => item.name).join(' · ');
    },
    filterDialectOption(keyword, option, path = []) {
      const normalizedKeyword = String(keyword || '').trim().toLowerCase();
      const searchable = [
        ...path.map((item) => item.name), option?.name, option?.qualified_code, option?.code,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedKeyword);
    },
    recentDialectsStorageKey() {
      return `can_create_recent_dialects_v1:${getCanDraftOwnerScope()}`;
    },
    loadRecentDialectIds() {
      try {
        const value = JSON.parse(uni.getStorageSync(this.recentDialectsStorageKey()) || '[]');
        this.recentDialectIds = Array.isArray(value) ? value.slice(0, 3) : [];
      } catch (error) {
        this.recentDialectIds = [];
      }
    },
    chooseDialect(event) {
      if (this.submitting || this.submitted) return;
      const value = event?.detail?.value ?? event?.value;
      const index = this.dialects.findIndex((item) => String(item.id) === String(value));
      const path = findDialectPath(this.dialectTree, value);
      if (index < 0 || path[path.length - 1]?.children.length) return;
      this.dialectIndex = index;
      this.dialectPickerVisible = false;
      this.recentDialectIds = [
        Number(value), ...this.recentDialectIds.filter((id) => String(id) !== String(value)),
      ].slice(0, 3);
      try {
        uni.setStorageSync(this.recentDialectsStorageKey(), JSON.stringify(this.recentDialectIds));
      } catch (error) {
        // A full local cache must not prevent selecting a dialect.
      }
    },
    chooseSource(event) {
      this.sourcePickerVisible = false;
      if (this.submitting || this.submitted) return;
      const value = (event?.detail?.value || event?.value || [])[0];
      const index = SOURCE_OPTIONS.findIndex((item) => item.value === value);
      if (index >= 0) this.sourceIndex = index;
    },
    async submit() {
      if (this.submitting || this.submitted || this.loading || !this.contextLoaded) return;
      this.submitting = true;
      this.submitError = '';
      try {
        if (await this.$refs.form.validate() !== true) return;
        const writing = String(this.form.text_content || '').trim();
        const reading = String(this.form.pronunciation_text || '').trim();
        const sourceOption = SOURCE_OPTIONS[this.sourceIndex];
        const source = Object.fromEntries(Object.entries({
          type: sourceOption.value,
          ...this.form.source,
        }).filter(([, value]) => String(value || '').trim()));
        const created = await createNameplate(this.canId, {
          text_content: writing,
          pronunciation_text: reading,
          definition: String(this.form.definition || '').trim(),
          dialect_id: this.selectedDialect?.id,
          evidence_level: sourceOption.value === 'creator' ? 1 : 2,
          source,
        });
        this.submitted = true;
        notifySuccess('铭牌已发表');
        goNameplateDetail(created.id, {}, { replace: true });
      } catch (error) {
        // Keep the draft and a persistent retry hint; httpClient owns the toast.
        this.submitError = error.message || '铭牌发表失败，请重试';
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.create-page { padding-bottom: 70rpx; }
.create-page__notice {
  padding: 28rpx 30rpx;
  border: 1rpx solid var(--border-color);
  border-left: 8rpx solid var(--accent-color);
  border-radius: 6rpx;
  background: var(--accent-subtle-color);
}
.create-page__notice-title {
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: 31rpx;
  font-weight: 900;
}
.create-page__notice-copy {
  margin-top: 10rpx;
  color: var(--text-secondary-color);
  font-size: 23rpx;
  line-height: 1.6;
}
.reference-card {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border: 1rpx dashed var(--border-color);
  background: var(--surface-color);
}
.reference-card__label {
  color: var(--danger-color);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}
.reference-card__writing {
  margin-top: 8rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 44rpx;
  font-weight: 900;
}
.reference-card__copy { margin-top: 8rpx; color: var(--text-secondary-color); font-size: 23rpx; }
.form-sheet {
  margin: 24rpx 0;
  padding: var(--space-3);
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}
.form-sheet__title {
  padding-bottom: var(--space-2);
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
.form-sheet__hint {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}
/* Match the authoring controls on the can creation page. */
.form-sheet :deep(.dialect-cell) { padding: 0; background: transparent; min-width: 0; }
.dialect-cell :deep(.t-cell__title) {
  overflow: hidden;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-field { margin-bottom: var(--space-3); }
.picker-label {
  margin-bottom: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.dialect-shortcuts {
  padding: 0 var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border-color);
}
.dialect-shortcut-group + .dialect-shortcut-group { margin-top: var(--space-2); }
.dialect-shortcut-group__label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}
.dialect-shortcut-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.submit-error {
  margin-bottom: var(--space-3);
  color: var(--danger-color);
  font-size: var(--font-size-sm);
}
</style>
