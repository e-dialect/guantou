<template>
  <PageShell
    :title="appName"
    :show-back="false"
    :scroll="isGuest"
    :content-class="{ 'social-home-content': !isGuest }"
    action-text="装罐"
    @action="toCreate"
  >
    <view :class="['hero', { compact: !isGuest }]">
      <view class="eyebrow">
        方言词典 · 真实乡音
      </view>
      <view class="brand">
        {{ appName }}
      </view>
      <view class="subtitle">
        {{ heroSubtitle }}
      </view>
      <view
        v-if="primaryDialect"
        class="identity-note"
      >
        主方言 · {{ primaryDialect.qualified_code || primaryDialect.name }}
      </view>
    </view>

    <view
      v-if="isGuest"
      class="guest-note"
    >
      <text class="guest-note-title">
        不登录也能查、能听
      </text>
      <text class="guest-note-copy">
        先逛词典和公开罐头；需要提交乡音或支持铭牌时，我们再请你登录。
      </text>
    </view>

    <view
      class="search-box"
      @tap="toSearch"
    >
      <text class="search-icon">
        ⌕
      </text>
      <text class="search-placeholder">
        搜方言词、写法、拼音或普通话概念
      </text>
      <text class="search-action">
        去查词
      </text>
    </view>

    <view
      :class="['quick-grid', { compact: !isGuest }]"
    >
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
      v-if="isGuest"
      :title="canSectionTitle"
      action-text="全部"
      @action="toCans"
    >
      <CanList
        ref="homeCanList"
        :fetcher="listCans"
        :query="canQuery"
        :scroll="false"
        :show-load-more="false"
        :max-items="5"
        :empty-title="canEmptyTitle"
        :empty-description="canEmptyDescription"
        empty-action-text="装一罐"
        @open="toCan"
        @empty-action="toCreate"
      />
    </SectionBlock>
    <SocialCanFeeds
      v-else
      ref="socialFeeds"
      :fetcher="listCans"
      @author="toUser"
      @comment="toCan"
      @open="toCan"
      @share="prepareShare"
    />
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import SocialCanFeeds from '@/components/SocialCanFeeds.vue';
import { listCans } from '@/services/guantou';
import { APP_NAME, SHARE_TITLE } from '@/const/branding';
import { toUserPage } from '@/routers/user';
import { canSharePayload } from '@/utils/shareCan';

export default {
  components: {
    CanList,
    PageShell,
    SectionBlock,
    SocialCanFeeds,
  },
  data() {
    const app = typeof getApp === 'function' ? getApp() : null;
    return {
      appName: APP_NAME,
      primaryDialect: app?.globalData?.userInfo?.primary_dialect || null,
      pendingShareCan: null,
    };
  },
  computed: {
    isGuest() {
      return !uni.getStorageSync('token');
    },
    heroSubtitle() {
      return this.isGuest
        ? '先查一个词，再听听它在不同地方怎么说'
        : '把每一段乡音装进可校验的资料库';
    },
    canSectionTitle() {
      return this.isGuest ? '公开乡音' : '待贴铭牌';
    },
    canQuery() {
      return this.isGuest ? {} : { needs_label: 'true' };
    },
    canEmptyTitle() {
      return this.isGuest ? '还没有公开罐头' : '还没有待贴铭牌的罐头';
    },
    canEmptyDescription() {
      return this.isGuest
        ? '可以先查词看看，或者录下第一段公开乡音。'
        : '可以先装一罐乡音，后面的人就能继续贴铭牌。';
    },
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
        {
          key: 'discovery',
          title: '发现',
          copy: '热罐头与今日方言词',
          open: this.toDiscovery,
        },
        {
          key: 'circle',
          title: '方言圈',
          copy: '和同乡一起听与校验',
          open: this.toCircles,
        },
      ];
    },
  },
  onShareAppMessage() {
    if (this.pendingShareCan) return canSharePayload(this.pendingShareCan);
    return {
      title: SHARE_TITLE,
      path: '/pages/index',
    };
  },
  onShow() {
    const app = typeof getApp === 'function' ? getApp() : null;
    this.primaryDialect = app?.globalData?.userInfo?.primary_dialect || null;
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
    toUser(id) {
      toUserPage(id);
    },
    prepareShare(can) {
      this.pendingShareCan = can;
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
    toDiscovery() {
      uni.navigateTo({ url: '/pages/discovery/index' });
    },
    toCircles() {
      uni.navigateTo({ url: '/pages/circles/index' });
    },
  },
};
</script>

<style scoped>
.hero {
  margin-bottom: 30rpx;
}

.hero.compact {
  margin-bottom: 20rpx;
}

.hero.compact .brand {
  font-size: 42rpx;
}

:deep(.social-home-content) {
  display: flex;
  height: calc(100vh - 96rpx);
  min-height: 0;
  flex-direction: column;
}

.eyebrow {
  margin-bottom: 12rpx;
  color: #7b4f2f;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 5rpx;
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

.identity-note {
  display: inline-block;
  margin-top: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #e8f1eb;
  color: #1f5c43;
  font-size: 24rpx;
  font-weight: 700;
}

.guest-note {
  margin-bottom: 24rpx;
  padding: 22rpx 24rpx;
  border: 1px solid #d8e4d5;
  border-left: 8rpx solid #1f5c43;
  border-radius: 12rpx;
  background: #f1f7ef;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.guest-note-title {
  color: #1f5c43;
  font-size: 28rpx;
  font-weight: 800;
}

.guest-note-copy {
  color: #526258;
  font-size: 25rpx;
  line-height: 1.55;
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
  flex: 1;
  min-width: 0;
  color: #7a867d;
  font-size: 28rpx;
  overflow-wrap: anywhere;
}

.search-action {
  flex: 0 0 auto;
  color: #1f5c43;
  font-size: 25rpx;
  font-weight: 800;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin: 28rpx 0;
}

.quick-grid.compact {
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin: 18rpx 0;
}

.quick-grid.compact .quick-card {
  min-height: 104rpx;
  padding: 16rpx 12rpx;
}

.quick-grid.compact .quick-title {
  font-size: 28rpx;
}

.quick-grid.compact .quick-copy {
  display: none;
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

.discovery {
  background: #7f632e;
}

.circle {
  background: #426475;
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
