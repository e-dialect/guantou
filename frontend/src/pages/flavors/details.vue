<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text><text class="title">
        义项详情
      </text>
    </view>
    <scroll-view
      v-if="flavor"
      scroll-y
      class="content"
    >
      <view class="section">
        <view class="name">
          {{ flavor.name }}
        </view>
        <view class="definition">
          {{ flavor.definition }}
        </view>
        <button
          class="primary-button"
          @tap="toCreateForFlavor"
        >
          用我的方言录一版
        </button>
      </view>
      <view class="section">
        <view class="section-title">
          写法
        </view>
        <text
          v-for="link in flavor.package_links"
          :key="link.id"
          class="tag"
        >
          {{ link.package.text }}
        </text>
      </view>
      <view class="section">
        <view class="section-title">
          读音变体
        </view>
        <view
          v-for="variant in flavor.variants"
          :key="variant.id"
          class="variant"
        >
          <text>{{ variant.dialect_detail ? variant.dialect_detail.name : '未标方言点' }}</text>
          <text>{{ variant.romanization || variant.ipa || '未标音' }}</text>
        </view>
      </view>
      <view class="section">
        <view class="section-title">
          相关罐头
        </view>
        <view
          v-for="can in relatedCans"
          :key="can.id"
          class="can-card"
          @tap="toCan(can.id)"
        >
          <view class="can-title">
            {{ primaryText(can) }}
          </view>
          <view class="can-meta">
            {{ locationText(can) }} · {{ can.nameplates.length }} 张铭牌
          </view>
          <button
            class="play-button"
            @tap.stop="playAudio(can.audio_url)"
          >
            播放乡音
          </button>
        </view>
        <view
          v-if="!relatedCans.length"
          class="empty"
        >
          还没有相关罐头
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getFlavor, listCans } from '@/services/guantou';
import { playAudio } from '@/utils/audio';

export default {
  data() {
    return { flavor: null, id: 0, relatedCans: [] };
  },
  async onLoad(options) {
    this.id = options.id;
    await this.refresh();
  },
  methods: {
    playAudio,
    async refresh() {
      this.flavor = await getFlavor(this.id);
      const res = await listCans({ flavor: this.id });
      this.relatedCans = res.results || res;
    },
    primaryText(can) {
      return can.primary_nameplate
        ? can.primary_nameplate.text_content
        : (can.concept_text || '无标罐头');
    },
    locationText(can) {
      if (can.dialect_detail) return can.dialect_detail.name;
      return [can.county, can.town].filter(Boolean).join('-') || '未标产地';
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
    toCreateForFlavor() {
      uni.navigateTo({
        url: `/pages/cans/create?flavor=${this.id}&flavor_name=${encodeURIComponent(this.flavor.name)}`,
      });
    },
    goBack() {
      uni.navigateBack();
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
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  background: #fff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 54rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.content {
  height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.section {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.name {
  font-size: 42rpx;
  font-weight: 800;
}

.definition {
  margin-top: 14rpx;
  color: #425148;
}

.section-title {
  font-weight: 700;
  margin-bottom: 16rpx;
}

.tag {
  display: inline-block;
  margin: 0 12rpx 12rpx 0;
  background: #e8f1eb;
  color: #1f5c43;
  border-radius: 999rpx;
  padding: 8rpx 18rpx;
}

.primary-button {
  margin-top: 24rpx;
  background: #1f5c43;
  color: #fff;
  border-radius: 12rpx;
}

.variant {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1px solid #eef1eb;
}

.can-card {
  border-bottom: 1px solid #eef1eb;
  padding: 18rpx 0;
}

.can-title {
  font-size: 30rpx;
  font-weight: 700;
}

.can-meta {
  margin-top: 8rpx;
  color: #6c776e;
  font-size: 24rpx;
}

.play-button {
  margin: 14rpx 0 0;
  font-size: 24rpx;
  background: #fff;
  border: 1px solid #cbd5c5;
  color: #2f4638;
}

.empty {
  color: #7a867d;
  padding: 18rpx 0;
}
</style>
