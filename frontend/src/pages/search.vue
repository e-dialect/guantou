<template>
  <SearchPanel
    v-model="keywords"
    :hot-tags="hotTags"
    :history-list="historyList"
    :suggestions="suggestions"
    :results="results"
    :has-searched="hasSearched"
    :loading="searchLoading"
    :error-message="searchError"
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
import {
  listHotSearches,
  searchGuantou,
  suggestGuantou,
} from '@/services/guantou';
import {
  goBack,
  goCanDetail,
  goCreateCan,
  goNameplateDetail,
  openPage,
} from '@/services/navigation';
import { defaultMessage } from '@/services/shareMessages';

function emptyResults() {
  return {
    flavors: [],
    packages: [],
    nameplates: [],
    cans: [],
  };
}

function flattenSuggestions(response) {
  const scopeByType = {
    flavor: 'flavors',
    package: 'packages',
    nameplate: 'nameplates',
  };
  const labelByType = {
    flavor: '义项',
    package: '写法',
    nameplate: '铭牌',
  };
  return (response.suggestions || []).map((item) => ({
    id: item.id,
    scope: scopeByType[item.type],
    type: labelByType[item.type],
    title: item.text,
    description: item.sub,
    meta: '',
  }));
}

export default {
  components: {
    SearchPanel,
  },
  data() {
    return {
      hasSearched: false,
      hotTags: [],
      hotTagsLoaded: false,
      historyList: [],
      keywords: '',
      lastSearchedKeyword: '',
      suggestions: [],
      suggestRequestId: 0,
      searchLoading: false,
      searchError: '',
      results: emptyResults(),
    };
  },
  onLoad(option) {
    this.loadHistory();
    this.loadHotTags();
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
    async loadHotTags() {
      if (this.hotTagsLoaded) return;
      this.hotTagsLoaded = true;
      try {
        const terms = await listHotSearches({ limit: 8 });
        this.hotTags = (terms || []).map((item) => item.keyword).filter(Boolean);
      } catch (error) {
        this.hotTags = [];
      }
    },
    goBack() {
      goBack();
    },
    async search(keyword = this.keywords) {
      const search = String(keyword || '').trim();
      if (!search) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' });
        return;
      }
      this.keywords = search;
      this.suggestRequestId += 1;
      this.searchLoading = true;
      this.searchError = '';
      this.results = emptyResults();
      this.hasSearched = true;
      try {
        this.results = await searchGuantou(search);
        this.suggestions = [];
        this.lastSearchedKeyword = search;
        this.recordHistory(search);
      } catch (error) {
        this.searchError = '搜索失败，请稍后重试';
      } finally {
        this.searchLoading = false;
      }
    },
    async suggest(keyword) {
      if (this.hasSearched) return;
      const requestId = this.suggestRequestId + 1;
      this.suggestRequestId = requestId;
      try {
        const results = await suggestGuantou(keyword, { limit: 5 });
        if (requestId !== this.suggestRequestId || this.hasSearched) return;
        this.suggestions = flattenSuggestions(results);
      } catch (error) {
        if (requestId === this.suggestRequestId) this.suggestions = [];
      }
    },
    onKeywordInput(value) {
      const keyword = String(value || '').trim();
      if (!keyword) {
        this.suggestRequestId += 1;
        this.suggestions = [];
      }
      if (!this.hasSearched || keyword === this.lastSearchedKeyword) return;
      this.suggestRequestId += 1;
      this.hasSearched = false;
      this.searchError = '';
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
      goCanDetail(id);
    },
    openItem(item) {
      if (item.scope === 'cans') {
        this.openCan(item.id);
        return;
      }
      if (item.scope === 'nameplates') {
        goNameplateDetail(item.id);
        return;
      }
      if (item.scope === 'flavors') {
        const ids = item.flavor_ids || [item.id];
        openPage(`/pages/flavors/details?id=${ids[0]}&ids=${ids.join(',')}`);
        return;
      }
      const urls = {
        packages: `/pages/packages/details?id=${item.id}`,
      };
      openPage(urls[item.scope]);
    },
    toCreateCan() {
      goCreateCan();
    },
  },
};
</script>
