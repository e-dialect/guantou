<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text>
      <input
        v-model="keywords"
        class="search"
        placeholder="搜索义项、写法、罐头"
        :focus="true"
        confirm-type="search"
        @confirm="search"
      >
      <button
        class="button"
        @tap="search"
      >
        搜索
      </button>
    </view>

    <scroll-view
      scroll-y
      class="list"
    >
      <view
        v-if="!hasSearched"
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
            @tap="searchKeyword(tag)"
          >
            {{ tag }}
          </text>
        </view>
      </view>
      <view
        v-if="!hasSearched && historyList.length"
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
            @tap="searchKeyword(item)"
          >
            {{ item }}
          </text>
        </view>
      </view>
      <EmptyState
        v-if="!hasSearched && !historyList.length"
        title="输入一个概念或写法"
        description="比如月亮、行、杀，也可以直接搜某张铭牌。"
      />

      <view v-if="hasSearched">
        <ResultSection
          title="义项"
          :items="results.flavors"
          empty-title="没有匹配义项"
        >
          <view
            v-for="item in results.flavors"
            :key="`flavor-${item.id}`"
            class="result-card"
            @tap="openItem('flavors', item)"
          >
            <view class="type">
              义项
            </view>
            <view class="title">
              {{ item.name }}
            </view>
            <view class="description">
              {{ item.definition }}
            </view>
            <view class="meta">
              {{ item.variants.length }} 个变体 · {{ item.package_links.length }} 个写法
            </view>
          </view>
        </ResultSection>

        <ResultSection
          title="写法"
          :items="results.packages"
          empty-title="没有匹配写法"
        >
          <view
            v-for="item in results.packages"
            :key="`package-${item.id}`"
            class="result-card"
            @tap="openItem('packages', item)"
          >
            <view class="type">
              写法
            </view>
            <view class="title">
              {{ item.text }}
            </view>
            <view class="description">
              查看这个写法关联的义项
            </view>
            <view class="meta">
              {{ item.flavors.length }} 个义项 · {{ item.package_type || 'uncertain' }}
            </view>
          </view>
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
            @open="openCan"
          />
        </ResultSection>

        <EmptyState
          v-if="!totalResults"
          title="没有找到结果"
          description="换个写法试试，或者先装一罐。"
          action-text="装一罐"
          @action="toCreateCan"
        />
      </view>
    </scroll-view>
  </view>
</template>

<script>
import CanCard from '@/components/CanCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import ResultSection from '@/components/ResultSection.vue';
import { APP_NAME } from '@/const/branding';
import { searchGuantou } from '@/services/guantou';
import { defaultMessage } from '@/services/shareMessages';

export default {
  components: {
    CanCard,
    EmptyState,
    ResultSection,
  },
  data() {
    return {
      hasSearched: false,
      hotTags: ['月亮', '膝盖', '祖母', '行', '杀', '吃饭'],
      historyList: [],
      keywords: '',
      results: {
        flavors: [],
        packages: [],
        cans: [],
      },
    };
  },
  computed: {
    totalResults() {
      return this.results.flavors.length
        + this.results.packages.length
        + this.results.cans.length;
    },
  },
  onLoad(option) {
    this.loadHistory();
    if (option.keywords || option.key) {
      this.keywords = option.keywords || option.key;
      this.search();
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
    async search() {
      const search = this.keywords.trim();
      if (!search) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' });
        return;
      }
      this.results = await searchGuantou(search);
      this.hasSearched = true;
      this.recordHistory(search);
    },
    searchKeyword(keyword) {
      this.keywords = keyword;
      this.search();
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
    openItem(scope, item) {
      const urls = {
        flavors: `/pages/flavors/details?id=${item.id}`,
        packages: `/pages/packages/details?id=${item.id}`,
      };
      uni.navigateTo({ url: urls[scope] });
    },
    toCreateCan() {
      uni.navigateTo({ url: '/pages/cans/create' });
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
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  background: #fff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 44rpx;
}

.search {
  background: #f6f7f3;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  padding: 16rpx 22rpx;
  font-size: 28rpx;
}

.button {
  margin: 0;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 26rpx;
}

.list {
  height: calc(100vh - 96rpx);
  padding: 24rpx 28rpx;
  box-sizing: border-box;
}

.result-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.type {
  color: #1f5c43;
  font-size: 24rpx;
  margin-bottom: 8rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.description {
  margin-top: 10rpx;
  color: #425148;
  line-height: 1.5;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
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
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 999rpx;
  color: #1f5c43;
  padding: 12rpx 20rpx;
  font-size: 26rpx;
}
</style>
