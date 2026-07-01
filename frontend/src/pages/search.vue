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
        placeholder="搜索概念、铭牌、包装"
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

    <view class="tabs">
      <view
        v-for="(scope, index) in searchScopes"
        :key="scope.value"
        :class="['tab', index === searchScopeIndex ? 'active' : '']"
        @tap="checkout(index)"
      >
        {{ scope.label }}
      </view>
    </view>

    <scroll-view
      scroll-y
      class="list"
    >
      <view
        v-if="!hasSearched"
        class="empty"
      >
        输入普通话概念、罐头铭牌或包装文字
      </view>
      <view
        v-for="item in results"
        :key="item.id"
        class="result-card"
        @tap="openItem(item)"
      >
        <view class="title">
          {{ displayTitle(item) }}
        </view>
        <view class="description">
          {{ displayDescription(item) }}
        </view>
        <view class="meta">
          {{ displayMeta(item) }}
        </view>
      </view>
      <view
        v-if="hasSearched && !results.length"
        class="empty"
      >
        没有找到结果
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { listCans, listFlavors } from '@/services/guantou';
import { defaultMessage } from '@/services/shareMessages';

export default {
  data() {
    return {
      hasSearched: false,
      searchScopeIndex: 0,
      searchScopes: [
        { label: '风味', value: 'flavors' },
        { label: '罐头', value: 'cans' },
      ],
      keywords: '',
      results: [],
    };
  },
  onLoad(option) {
    if (option.index) this.searchScopeIndex = Number(option.index);
    if (option.keywords || option.key) {
      this.keywords = option.keywords || option.key;
      this.search();
    }
  },
  onShareAppMessage() {
    return {
      title: `方言罐头：${this.keywords || '搜索'}`,
      path: `/pages/search?index=${this.searchScopeIndex}&keywords=${this.keywords}`,
      ...defaultMessage(),
    };
  },
  methods: {
    goBack() {
      uni.navigateBack();
    },
    checkout(index) {
      this.searchScopeIndex = index;
      if (this.hasSearched) this.search();
    },
    async search() {
      const search = this.keywords.trim();
      if (!search) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' });
        return;
      }
      const scope = this.searchScopes[this.searchScopeIndex].value;
      const res = scope === 'flavors'
        ? await listFlavors({ search })
        : await listCans({ search });
      this.results = res.results || res;
      this.hasSearched = true;
    },
    displayTitle(item) {
      if (this.searchScopes[this.searchScopeIndex].value === 'flavors') {
        return item.name;
      }
      return item.primary_nameplate
        ? item.primary_nameplate.text_content
        : (item.concept_text || '无标罐头');
    },
    displayDescription(item) {
      if (this.searchScopes[this.searchScopeIndex].value === 'flavors') {
        return item.definition;
      }
      return item.concept_text || '未填写普通话概念';
    },
    displayMeta(item) {
      if (this.searchScopes[this.searchScopeIndex].value === 'flavors') {
        return `${item.variants.length} 个变体 · ${item.package_links.length} 个包装`;
      }
      const location = item.dialect_detail
        ? item.dialect_detail.name
        : [item.county, item.town].filter(Boolean).join('-');
      return `${location || '未标产地'} · ${item.nameplates.length} 张铭牌`;
    },
    openItem(item) {
      const scope = this.searchScopes[this.searchScopeIndex].value;
      const url = scope === 'flavors'
        ? `/pages/flavors/details?id=${item.id}`
        : `/pages/cans/details?id=${item.id}`;
      uni.navigateTo({ url });
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

.tabs {
  display: flex;
  gap: 16rpx;
  padding: 22rpx 28rpx 0;
}

.tab {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 1px solid #d9dfd5;
  color: #526158;
}

.tab.active {
  color: #fff;
  background: #1f5c43;
  border-color: #1f5c43;
}

.list {
  height: calc(100vh - 170rpx);
  padding: 24rpx 28rpx;
  box-sizing: border-box;
}

.result-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.description {
  margin-top: 10rpx;
  color: #425148;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}

.empty {
  padding: 80rpx 20rpx;
  text-align: center;
  color: #7a867d;
}
</style>
