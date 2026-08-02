<template>
  <PageShell
    :title="appName"
    :show-back="false"
    action-text="装罐"
    @action="toCreate"
  >
    <view class="hero">
      <view class="brand">
        {{ appName }}
      </view>
      <view class="subtitle">
        把每一段乡音装进可校验的资料库
      </view>
    </view>

    <view
      class="search-box"
      @tap="toSearch"
    >
      <text class="search-icon">
        ⌕
      </text>
      <text class="search-placeholder">
        搜索方言、正字、拼音、普通话概念
      </text>
    </view>

    <view class="quick-grid">
      <view
        v-for="entry in quickEntries"
        :key="entry.key"
        :class="['quick-card', entry.key]"
        @tap="entry.open"
      >
        <view class="quick-title">
          {{ entry.title }}
        </view>
        <view class="quick-copy">
          {{ entry.copy }}
        </view>
      </view>
    </view>

    <SectionBlock
      title="待贴铭牌"
      action-text="全部"
      @action="toCans"
    >
      <CanList
        ref="homeCanList"
        :fetcher="listCans"
        :query="{ needs_label: 'true' }"
        :scroll="false"
        :show-load-more="false"
        :max-items="5"
        empty-title="还没有待贴铭牌的罐头"
        empty-description="可以先装一罐乡音，后面的人就能继续贴铭牌。"
        empty-action-text="装一罐"
        @open="toCan"
        @empty-action="toCreate"
      />
    </SectionBlock>
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { listCans } from '@/services/guantou';
import { APP_NAME, SHARE_TITLE } from '@/const/branding';

export default {
  components: {
    CanList,
    PageShell,
    SectionBlock,
  },
  data() {
    return {
      appName: APP_NAME,
    };
  },
  computed: {
    quickEntries() {
      return [
        {
          key: 'shelf',
          title: '集盒',
          copy: '按主题收纳乡音',
          open: this.toShelves,
        },
        {
          key: 'can',
          title: '装罐',
          copy: '录下新的乡音',
          open: this.toCreate,
        },
        {
          key: 'atlas',
          title: '图鉴',
          copy: '看同一概念的不同写法',
          open: this.toFlavors,
        },
        {
          key: 'mine',
          title: '我的',
          copy: '贡献、积分和消息',
          open: this.toMine,
        },
      ];
    },
  },
  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: '/pages/index',
    };
  },
  methods: {
    listCans,
    toSearch() {
      uni.navigateTo({ url: '/pages/search' });
    },
    toCreate() {
      uni.navigateTo({ url: '/pages/cans/create' });
    },
    toCans() {
      uni.navigateTo({ url: '/pages/cans/index' });
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toFlavors() {
      uni.navigateTo({ url: '/pages/flavors/index' });
    },
    toShelves() {
      uni.navigateTo({ url: '/pages/shelves/index' });
    },
    toMine() {
      uni.navigateTo({ url: '/pages/users/me' });
    },
  },
};
</script>

<style scoped>
.hero {
  margin-bottom: 30rpx;
}

.brand {
  font-size: 54rpx;
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: 0;
}

.subtitle {
  margin-top: 12rpx;
  color: #5d6b61;
  font-size: 27rpx;
}

.search-box {
  min-height: 82rpx;
  border-radius: 16rpx;
  background: #ffffff;
  border: 1px solid #dfe5da;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  gap: 14rpx;
  box-sizing: border-box;
}

.search-icon {
  font-size: 34rpx;
  color: #1f5c43;
}

.search-placeholder {
  min-width: 0;
  color: #7a867d;
  font-size: 28rpx;
  overflow-wrap: anywhere;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin: 28rpx 0;
}

.quick-card {
  min-height: 168rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.shelf {
  background: #264d59;
}

.can {
  background: #1f5c43;
}

.atlas {
  background: #7b4f2f;
}

.mine {
  background: #555d49;
}

.quick-title {
  font-size: 34rpx;
  font-weight: 800;
}

.quick-copy {
  font-size: 25rpx;
  opacity: 0.9;
}
</style>
