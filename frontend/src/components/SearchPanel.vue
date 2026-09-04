<template>
  <view class="search-panel">
    <view class="searchbar">
      <text
        class="back"
        @tap="$emit('back')"
      >
        ‹
      </text>
      <BaseField
        v-model="localKeyword"
        class="search-field"
        name="search"
        placeholder="搜索义项、写法、罐头"
        aria-role="searchbox"
        aria-label="搜索"
        confirm-type="search"
        clearable
        focus
        @enter="submitSearch"
      />
      <BaseButton
        class="search-button"
        size="small"
        text="搜索"
        @click="submitSearch"
      />
    </view>

    <scroll-view
      scroll-y
      class="search-content"
    >
      <view v-if="!hasSearched">
        <ResultSection
          v-if="suggestions.length"
          title="联想"
          :items="suggestions"
          empty-title="暂无联想"
        >
          <EntityCard
            v-for="item in suggestions"
            :key="`${item.scope}-${item.id}`"
            :type="item.type"
            :title="item.title"
            :description="item.description"
            :meta="item.meta"
            :item="item"
            @open="$emit('open', $event)"
          />
        </ResultSection>

        <view
          v-if="hotTags.length"
          class="quick-section"
        >
          <view class="quick-title">
            热门搜索
          </view>
          <view class="tag-row">
            <text
              v-for="tag in hotTags"
              :key="tag"
              class="tag"
              @tap="pickKeyword(tag, 'hot')"
            >
              {{ tag }}
            </text>
          </view>
        </view>
        <view
          v-if="historyList.length"
          class="quick-section"
        >
          <view class="quick-title">
            搜索历史
          </view>
          <view class="tag-row">
            <text
              v-for="item in historyList"
              :key="item"
              class="tag"
              @tap="pickKeyword(item, 'history')"
            >
              {{ item }}
            </text>
          </view>
        </view>
        <EmptyState
          v-if="!historyList.length && !suggestions.length"
          title="输入一个概念或写法"
          description="比如月亮、行、杀，也可以直接搜某张铭牌。"
        />
      </view>

      <view v-else>
        <EmptyState
          v-if="errorMessage"
          title="搜索失败"
          :description="errorMessage"
          action-text="重新搜索"
          @action="submitSearch"
        />
        <view
          v-else-if="loading"
          class="search-status"
        >
          正在搜索…
        </view>
        <template v-else>
          <ResultSection
            title="义项"
            :items="groupedFlavors"
            empty-title="没有匹配义项"
          >
            <EntityCard
              v-for="item in groupedFlavors"
              :key="`flavor-${item.id}`"
              type="义项"
              :title="item.name"
              :description="item.definition"
              :meta="flavorMeta(item)"
              :item="{ ...item, scope: 'flavors' }"
              @open="$emit('open', $event)"
            />
          </ResultSection>

          <ResultSection
            title="写法"
            :items="results.packages"
            empty-title="没有匹配写法"
          >
            <EntityCard
              v-for="item in results.packages"
              :key="`package-${item.id}`"
              type="写法"
              :title="item.text"
              description="查看这个写法关联的义项"
              :meta="packageMeta(item)"
              :item="{ ...item, scope: 'packages' }"
              @open="$emit('open', $event)"
            />
          </ResultSection>

          <ResultSection
            title="铭牌"
            :items="results.nameplates"
            empty-title="没有匹配铭牌"
          >
            <EntityCard
              v-for="item in results.nameplates"
              :key="`nameplate-${item.id}`"
              type="铭牌"
              :title="item.display_text"
              :description="item.definition || '暂无释义'"
              :meta="item.dialect?.qualified_code || item.dialect?.name || '方言点待补'"
              :item="{ ...item, scope: 'nameplates' }"
              @open="$emit('open', $event)"
            />
          </ResultSection>

          <ResultSection
            title="罐头"
            :items="results.cans"
            empty-title="没有匹配罐头"
          >
            <CanCard
              v-for="item in results.cans"
              :key="`can-${item.id}`"
              :can="item"
              @open="$emit('open-can', $event)"
            />
          </ResultSection>

          <EmptyState
            v-if="!totalResults"
            title="没有找到结果"
            description="换个写法试试，或者先装一罐。"
            action-text="装一罐"
            @action="$emit('create-can')"
          />
        </template>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import CanCard from './CanCard.vue';
import BaseButton from './BaseButton.vue';
import BaseField from './BaseField.vue';
import EmptyState from './EmptyState.vue';
import EntityCard from './EntityCard.vue';
import ResultSection from './ResultSection.vue';

const SUGGEST_DEBOUNCE_MS = 300;

function flavorGroupKey(item) {
  return `${String(item.name || '').trim()}||${String(item.definition || '').trim()}`;
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = String(item?.id ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupFlavorResults(items) {
  const groups = new Map();
  (items || []).forEach((flavor) => {
    const key = flavorGroupKey(flavor);
    if (!groups.has(key)) {
      groups.set(key, {
        ...flavor,
        flavor_ids: [],
        pronunciations: [],
        package_links: [],
      });
    }
    const group = groups.get(key);
    if (!group.flavor_ids.some((id) => String(id) === String(flavor.id))) {
      group.flavor_ids.push(flavor.id);
    }
    group.pronunciations = uniqueById(
      group.pronunciations.concat(flavor.pronunciations || []),
    );
    group.package_links = uniqueById(
      group.package_links.concat(flavor.package_links || []),
    );
  });
  return [...groups.values()];
}

export default {
  name: 'SearchPanel',
  components: {
    CanCard,
    BaseButton,
    BaseField,
    EmptyState,
    EntityCard,
    ResultSection,
  },
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    hotTags: {
      type: Array,
      default: () => [],
    },
    historyList: {
      type: Array,
      default: () => [],
    },
    suggestions: {
      type: Array,
      default: () => [],
    },
    results: {
      type: Object,
      default: () => ({
        flavors: [],
        packages: [],
        nameplates: [],
        cans: [],
      }),
    },
    hasSearched: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  emits: [
    'update:modelValue',
    'search',
    'suggest',
    'pick-hot',
    'pick-history',
    'open',
    'open-can',
    'create-can',
    'back',
  ],
  data() {
    return {
      localKeyword: this.modelValue,
      suggestTimer: null,
    };
  },
  computed: {
    groupedFlavors() {
      return groupFlavorResults(this.results.flavors);
    },
    totalResults() {
      return (this.results.flavors || []).length
        + (this.results.packages || []).length
        + (this.results.nameplates || []).length
        + (this.results.cans || []).length;
    },
  },
  watch: {
    modelValue(value) {
      if (value !== this.localKeyword) this.localKeyword = value;
    },
    localKeyword(value) {
      this.$emit('update:modelValue', value);
      this.queueSuggest(value);
    },
  },
  beforeUnmount() {
    this.clearSuggestTimer();
  },
  methods: {
    clearSuggestTimer() {
      if (!this.suggestTimer) return;
      clearTimeout(this.suggestTimer);
      this.suggestTimer = null;
    },
    queueSuggest(value) {
      this.clearSuggestTimer();
      const keyword = String(value || '').trim();
      if (!keyword) return;
      this.suggestTimer = setTimeout(() => {
        this.$emit('suggest', keyword);
      }, SUGGEST_DEBOUNCE_MS);
    },
    submitSearch() {
      this.$emit('search', this.localKeyword.trim());
    },
    pickKeyword(keyword, source) {
      this.localKeyword = keyword;
      this.$emit(source === 'hot' ? 'pick-hot' : 'pick-history', keyword);
      this.$emit('search', keyword);
    },
    flavorMeta(item) {
      return `${(item.pronunciations || []).length} 个读音 · ${(item.package_links || []).length} 个写法`;
    },
    packageMeta(item) {
      return `${(item.flavors || []).length} 个义项 · ${item.package_type || 'uncertain'}`;
    },
  },
};
</script>

<style scoped>
.search-panel {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.search-status {
  padding: 80rpx 30rpx;
  color: #66736b;
  text-align: center;
}

.searchbar {
  height: 96rpx;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  background: #ffffff;
  border-bottom: 1px solid #e8ebe4;
  box-sizing: border-box;
}

.back {
  font-size: 56rpx;
  width: 44rpx;
}

.search-field {
  min-width: 0;
}

.search-field :deep(.base-field) {
  padding: 0;
}

.search-field :deep(.t-input) {
  background: #f6f7f3;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.search-button {
  margin: 0;
}

.search-content {
  height: calc(100vh - 96rpx);
  padding: 24rpx 28rpx;
  box-sizing: border-box;
}

.quick-section {
  margin-bottom: 30rpx;
}

.quick-title {
  margin-bottom: 16rpx;
  color: #2f4638;
  font-weight: 700;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.tag {
  background: #ffffff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  color: #1f5c43;
  padding: 12rpx 20rpx;
  font-size: 26rpx;
}
</style>
