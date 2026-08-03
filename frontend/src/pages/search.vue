<template>
  <SearchPanel
    v-model="keywords"
    :hot-tags="hotTags"
    :history-list="historyList"
    :suggestions="suggestions"
    :results="results"
    :has-searched="hasSearched"
    @search="search"
    @suggest="suggest"
    @update:model-value="onKeywordInput"
    @open="openItem"
    @open-can="openCan"
    @create-can="toCreateCan"
    @back="goBack"
  />
</template>

<script>
import SearchPanel from '@/components/SearchPanel.vue';
import { APP_NAME } from '@/const/branding';
import { searchGuantou } from '@/services/guantou';
import { defaultMessage } from '@/services/shareMessages';

function emptyResults() {
  return {
    flavors: [],
    packages: [],
    cans: [],
  };
}

function flattenSuggestions(results) {
  const flavors = (results.flavors || []).map((item) => ({
    id: item.id,
    scope: 'flavors',
    type: '义项',
    title: item.name,
    description: item.definition,
    meta: `${(item.variants || []).length} 个变体`,
  }));
  const packages = (results.packages || []).map((item) => ({
    id: item.id,
    scope: 'packages',
    type: '写法',
    title: item.text,
    description: '查看这个写法关联的义项',
    meta: `${(item.flavors || []).length} 个义项`,
  }));
  const cans = (results.cans || []).map((item) => ({
    id: item.id,
    scope: 'cans',
    type: '罐头',
    title: item.primary_nameplate ? item.primary_nameplate.text_content : item.concept_text,
    description: item.concept_text || '未填写普通话概念',
    meta: item.dialect_detail ? item.dialect_detail.name : '未标方言点',
  }));
  return [...flavors, ...packages, ...cans].slice(0, 5);
}

export default {
  components: {
    SearchPanel,
  },
  data() {
    return {
      hasSearched: false,
      hotTags: ['月亮', '膝盖', '祖母', '行', '杀', '吃饭'],
      historyList: [],
      keywords: '',
      lastSearchedKeyword: '',
      suggestions: [],
      results: emptyResults(),
    };
  },
  onLoad(option) {
    this.loadHistory();
    if (option.keywords || option.key) {
      this.keywords = option.keywords || option.key;
      this.search(this.keywords);
    }
  },
  onShareAppMessage() {
    return {
      title: `${APP_NAME}：${this.keywords || '搜索'}`,
      path: `/pages/search?keywords=${this.keywords}`,
      ...defaultMessage(),
    };
  },
  methods: {
    goBack() {
      uni.navigateBack();
    },
    async search(keyword = this.keywords) {
      const search = String(keyword || '').trim();
      if (!search) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' });
        return;
      }
      this.keywords = search;
      this.results = await searchGuantou(search);
      this.suggestions = [];
      this.hasSearched = true;
      this.lastSearchedKeyword = search;
      this.recordHistory(search);
    },
    async suggest(keyword) {
      if (this.hasSearched) return;
      const results = await searchGuantou(keyword, { limit: 5 });
      this.suggestions = flattenSuggestions(results);
    },
    onKeywordInput(value) {
      if (!this.hasSearched) return;
      if (String(value || '').trim() === this.lastSearchedKeyword) return;
      this.hasSearched = false;
      this.results = emptyResults();
    },
    loadHistory() {
      try {
        this.historyList = JSON.parse(uni.getStorageSync('search_history') || '[]').slice(0, 8);
      } catch (error) {
        this.historyList = [];
      }
    },
    recordHistory(keyword) {
      this.historyList = [
        keyword,
        ...this.historyList.filter((item) => item !== keyword),
      ].slice(0, 8);
      uni.setStorage({
        key: 'search_history',
        data: JSON.stringify(this.historyList),
      });
    },
    openCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    openItem(item) {
      if (item.scope === 'cans') {
        this.openCan(item.id);
        return;
      }
      const urls = {
        flavors: `/pages/flavors/details?id=${item.id}`,
        packages: `/pages/packages/details?id=${item.id}`,
      };
      uni.navigateTo({ url: urls[item.scope] });
    },
    toCreateCan() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
  },
};
</script>
