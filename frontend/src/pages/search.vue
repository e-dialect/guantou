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
import {
  getNameplate,
  searchGuantou,
  suggestGuantou,
} from '@/services/guantou';
import { defaultMessage } from '@/services/shareMessages';

function emptyResults() {
  return {
    flavors: [],
    packages: [],
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
      const results = await suggestGuantou(keyword, { limit: 5 });
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
    async openItem(item) {
      if (item.scope === 'cans') {
        this.openCan(item.id);
        return;
      }
      if (item.scope === 'nameplates') {
        const nameplate = await getNameplate(item.id);
        this.openCan(nameplate.can.id);
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
