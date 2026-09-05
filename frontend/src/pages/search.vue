<template>
  <AppShell
    title="查找词条"
    active="search"
    @scrolltolower="loadMore"
  >
    <view class="entry-search">
      <view class="entry-search__lead">
        同一个“行”可能是“行走”的行，也可能是“银行”的行；这里会分别列出，不会混成一条。
      </view>

      <view class="entry-search__bar">
        <BaseField
          v-model="filters.keyword"
          name="keyword"
          label="写法、意思或读音"
          aria-role="searchbox"
          aria-label="写法、意思或读音"
          clearable
          placeholder="例如：行、害怕、hiŋ"
          @confirm="search"
        />
        <BaseButton
          text="查词条"
          :loading="loading"
          @click="search"
        />
      </view>

      <t-collapse
        v-model:value="openSections"
        class="entry-search__advanced"
        theme="card"
      >
        <t-collapse-panel
          value="advanced"
          header="高级筛选"
          header-right-content="地区、录音、写法、来源、IPA、罗马字"
        >
          <view class="filter-stack">
            <t-cell
              title="地区范围"
              :note="selectedDialectLabel"
              arrow
              hover
              @click="dialectPickerVisible = true"
            />
            <view
              v-if="filters.dialectId"
              class="filter-choice"
            >
              <BaseButton
                size="small"
                :variant="filters.dialectMatch === 'subtree' ? 'primary' : 'ghost'"
                text="包含下级地区"
                @click="filters.dialectMatch = 'subtree'"
              />
              <BaseButton
                size="small"
                :variant="filters.dialectMatch === 'exact' ? 'primary' : 'ghost'"
                text="仅这个范围"
                @click="filters.dialectMatch = 'exact'"
              />
              <BaseButton
                size="small"
                variant="ghost"
                text="清除地区"
                @click="clearDialect"
              />
            </view>

            <view class="filter-group">
              <text class="filter-group__label">
                录音状态
              </text>
              <view class="filter-choice">
                <BaseButton
                  v-for="item in audioOptions"
                  :key="item.label"
                  size="small"
                  :variant="filters.hasRecording === item.value ? 'primary' : 'ghost'"
                  :text="item.label"
                  @click="filters.hasRecording = item.value"
                />
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__label">
                整理状态
              </text>
              <view class="filter-choice">
                <BaseButton
                  v-for="item in statusOptions"
                  :key="item.value"
                  size="small"
                  :variant="filters.status === item.value ? 'primary' : 'ghost'"
                  :text="item.label"
                  @click="filters.status = item.value"
                />
              </view>
            </view>

            <t-cell
              title="写法类型"
              :note="writingTypeLabel"
              arrow
              hover
              @click="writingPickerVisible = true"
            />
            <t-cell
              title="证据来源"
              :note="sourceTypeLabel"
              arrow
              hover
              @click="sourcePickerVisible = true"
            />

            <BaseField
              v-model="filters.ipa"
              name="ipa"
              label="IPA"
              placeholder="输入完整或部分 IPA"
            />
            <BaseField
              v-model="filters.romanization"
              name="romanization"
              label="罗马字"
              placeholder="输入真实记录的罗马字"
            />
            <BaseField
              v-model="filters.source"
              name="source"
              label="来源"
              placeholder="方言志、田野记录或贡献说明"
            />
            <BaseField
              v-model="filters.concept"
              name="concept"
              label="概念"
              placeholder="例如 WALK；只发现关联词条，不自动合并"
            />
          </view>
        </t-collapse-panel>
      </t-collapse>

      <DialectSelector
        v-model:visible="dialectPickerVisible"
        :value="filters.dialectId"
        :dialects="dialects"
        :default-dialect="primaryDialect"
        :owner-scope="dialectOwnerScope"
        title="选择地区范围"
        @change="onDialectChange"
      />

      <t-picker
        :visible="writingPickerVisible"
        :value="[filters.writingType]"
        title="选择写法类型"
        @change="onWritingTypeChange"
        @close="writingPickerVisible = false"
      >
        <t-picker-item :options="writingTypes" />
      </t-picker>

      <t-picker
        :visible="sourcePickerVisible"
        :value="[filters.sourceType]"
        title="选择证据来源"
        @change="onSourceTypeChange"
        @close="sourcePickerVisible = false"
      >
        <t-picker-item :options="sourceTypes" />
      </t-picker>

      <BaseLoading
        v-if="loading && !entries.length"
        text="正在查找词条…"
      />
      <EmptyState
        v-else-if="errorMessage && !entries.length"
        :title="errorMessage"
        action-text="重试"
        @action="search"
      />
      <EmptyState
        v-else-if="searched && !entries.length"
        title="没有找到匹配词条"
        action-text="录一段，让大家帮忙整理"
        @action="goRecord"
      />

      <view
        v-else-if="entries.length"
        class="entry-results"
      >
        <view class="entry-results__summary">
          找到 {{ total }} 个独立词条
        </view>
        <view
          v-for="entry in entries"
          :key="entry.id"
          class="entry-result"
          role="button"
          :aria-label="`查看词条：${entryTitle(entry)}`"
          @tap="goEntryDetail(entry.id)"
        >
          <view class="entry-result__heading">
            <text class="entry-result__title">
              {{ entryTitle(entry) }}
            </text>
            <text class="entry-result__status">
              {{ statusLabel(entry.status) }}
            </text>
          </view>
          <view class="entry-result__summary">
            {{ entry.summary || '大意待补充' }}
          </view>
          <view class="entry-result__meta">
            <text>{{ dialectLabel(entry.usage_dialect) }}</text>
            <text>{{ entry.recording_count }} 段录音</text>
            <text v-if="entry.needs_audio">
              待补音
            </text>
          </view>
          <view
            v-if="entry.concepts?.length"
            class="entry-result__concepts"
          >
            概念：{{ entry.concepts.map((item) => item.label || item.code).join('、') }}
          </view>
        </view>
        <BaseLoading
          v-if="loadingMore"
          text="继续查找…"
        />
      </view>
    </view>
  </AppShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import AppShell from '@/components/AppShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import {
  buildEntrySearchParams,
  dialectLabel,
  entryTitle,
  listEntries,
  pageResults,
} from '@/services/entryRecording';
import { listAllDialects } from '@/services/guantou';
import { goEntryDetail, goRecord } from '@/services/navigation';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

const WRITING_TYPES = [
  { label: '不限', value: '' },
  { label: '汉字正字', value: 'orthographic' },
  { label: '俗写', value: 'popular' },
  { label: '借字', value: 'loan' },
  { label: '拟音', value: 'phonetic' },
  { label: '罗马字', value: 'romanization' },
  { label: '待考写法', value: 'uncertain' },
];

const SOURCE_TYPES = [
  { label: '不限', value: '' },
  { label: '用户原话', value: 'user_statement' },
  { label: '口述', value: 'oral' },
  { label: '田野记录', value: 'fieldwork' },
  { label: '书籍', value: 'book' },
  { label: '论文或文章', value: 'article' },
  { label: '档案', value: 'archive' },
  { label: '网页', value: 'web' },
  { label: '旧库原文', value: 'legacy' },
  { label: '其他', value: 'other' },
];

function defaultFilters() {
  return {
    keyword: '',
    dialectId: '',
    dialectMatch: 'subtree',
    writingType: '',
    sourceType: '',
    status: '',
    ipa: '',
    romanization: '',
    source: '',
    concept: '',
    hasRecording: '',
  };
}

function resultBucket(count) {
  if (count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}

function activeFilterCount(filters) {
  const advancedKeys = [
    'dialectId',
    'writingType',
    'sourceType',
    'status',
    'ipa',
    'romanization',
    'source',
    'concept',
    'hasRecording',
  ];
  return advancedKeys.filter((key) => (
    filters[key] !== '' && filters[key] !== null && filters[key] !== undefined
  )).length;
}

export default {
  components: {
    AppShell,
    BaseButton,
    BaseField,
    BaseLoading,
    EmptyState,
    DialectSelector,
    TCell,
    TCollapse,
    TCollapsePanel,
    TPicker,
    TPickerItem,
  },
  data() {
    return {
      filters: defaultFilters(),
      openSections: [],
      entries: [],
      total: 0,
      page: 1,
      next: null,
      searched: false,
      loading: false,
      loadingMore: false,
      errorMessage: '',
      searchRequestId: 0,
      dialects: [],
      dialectPickerVisible: false,
      writingPickerVisible: false,
      sourcePickerVisible: false,
      writingTypes: WRITING_TYPES,
      sourceTypes: SOURCE_TYPES,
      audioOptions: [
        { label: '不限', value: '' },
        { label: '有录音', value: true },
        { label: '待补音', value: false },
      ],
      statusOptions: [
        { label: '不限', value: '' },
        { label: '初稿', value: 'draft' },
        { label: '已整理', value: 'reviewed' },
        { label: '有分歧', value: 'disputed' },
      ],
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
        (item) => String(item.id) === String(this.filters.dialectId),
      );
      return dialect ? dialectBreadcrumb(dialect, this.dialects) : '不限地区';
    },
    writingTypeLabel() {
      return WRITING_TYPES.find((item) => item.value === this.filters.writingType)?.label || '不限';
    },
    sourceTypeLabel() {
      return SOURCE_TYPES.find((item) => item.value === this.filters.sourceType)?.label || '不限';
    },
  },
  async onLoad(options = {}) {
    this.filters.keyword = options.keywords || options.key || '';
    try {
      this.dialects = await listAllDialects();
    } catch (error) {
      this.dialects = [];
    }
    if (this.filters.keyword) await this.search();
  },
  methods: {
    dialectLabel,
    entryTitle,
    goEntryDetail,
    goRecord,
    statusLabel(status) {
      return {
        draft: '初稿',
        reviewed: '已整理',
        disputed: '有分歧',
        redirected: '已合并',
      }[status] || '待整理';
    },
    requestParams(page) {
      return buildEntrySearchParams({ ...this.filters, page, pageSize: 20 });
    },
    async search() {
      if (!ensureCapability(CAPABILITIES.ENTRY_SEARCH, 'search')) {
        this.searched = true;
        this.entries = [];
        this.errorMessage = '词条查询正在维护，请稍后再试';
        return;
      }
      const requestId = this.searchRequestId + 1;
      this.searchRequestId = requestId;
      this.loading = true;
      this.errorMessage = '';
      this.searched = true;
      try {
        const response = await listEntries(this.requestParams(1));
        if (requestId !== this.searchRequestId) return;
        this.entries = pageResults(response);
        this.total = Number(response?.count ?? this.entries.length);
        this.next = response?.next || null;
        this.page = 1;
        trackProductEvent(PRODUCT_EVENTS.ENTRY_SEARCH, {
          surface: 'search',
          result: this.total ? 'success' : 'empty',
          metadata: {
            result_bucket: resultBucket(this.total),
            filter_count: activeFilterCount(this.filters),
          },
        });
      } catch (error) {
        if (requestId !== this.searchRequestId) return;
        this.entries = [];
        this.total = 0;
        this.next = null;
        this.errorMessage = '词条查询失败，请稍后重试';
        trackProductEvent(PRODUCT_EVENTS.ENTRY_SEARCH, {
          surface: 'search',
          result: 'error',
          metadata: {
            result_bucket: '0',
            filter_count: activeFilterCount(this.filters),
          },
        });
      } finally {
        if (requestId === this.searchRequestId) this.loading = false;
      }
    },
    async loadMore() {
      if (!this.next || this.loadingMore) return;
      this.loadingMore = true;
      try {
        const page = this.page + 1;
        const response = await listEntries(this.requestParams(page));
        this.entries = [...this.entries, ...pageResults(response)];
        this.next = response?.next || null;
        this.page = page;
      } catch (error) {
        uni.showToast({ title: '暂时无法继续加载', icon: 'none' });
      } finally {
        this.loadingMore = false;
      }
    },
    onDialectChange(context = {}) {
      this.filters.dialectId = context.value || '';
    },
    clearDialect() {
      this.filters.dialectId = '';
      this.filters.dialectMatch = 'subtree';
    },
    onWritingTypeChange(context = {}) {
      this.filters.writingType = context.value?.[0] || '';
      this.writingPickerVisible = false;
    },
    onSourceTypeChange(context = {}) {
      this.filters.sourceType = context.value?.[0] || '';
      this.sourcePickerVisible = false;
    },
  },
};
</script>

<style scoped>
.entry-search {
  display: grid;
  gap: 24rpx;
}

.entry-search__lead,
.entry-result {
  padding: 26rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.entry-search__lead {
  color: var(--text-secondary-color);
  line-height: 1.7;
}

.entry-search__bar,
.filter-stack,
.entry-results {
  display: grid;
  gap: 18rpx;
}

.filter-group {
  display: grid;
  gap: 12rpx;
}

.filter-group__label,
.entry-results__summary {
  color: var(--muted-color);
  font-size: 23rpx;
}

.filter-choice,
.entry-result__meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.entry-result__heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
}

.entry-result__title {
  font-size: 36rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.entry-result__status {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-size: 22rpx;
}

.entry-result__summary {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.entry-result__meta,
.entry-result__concepts {
  margin-top: 16rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}
</style>
