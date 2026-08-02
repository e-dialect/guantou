<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text>
      <text class="title">
        罐头详情
      </text>
    </view>
    <scroll-view
      v-if="can"
      scroll-y
      class="content"
    >
      <view class="hero">
        <view class="label">
          {{ primaryText }}
        </view>
        <view class="concept">
          {{ can.concept_text || '未填写普通话概念' }}
        </view>
        <button
          class="play"
          @tap="playAudio(can.audio_url)"
        >
          播放乡音
        </button>
      </view>

      <view class="section">
        <view class="section-title">
          产地与状态
        </view>
        <view class="row">
          <text>方言点</text><text>{{ dialectText }}</text>
        </view>
        <view class="row">
          <text>状态</text><text>{{ statusText(can.status) }}</text>
        </view>
        <view class="row">
          <text>来源</text><text>{{ can.source_note || '未填写' }}</text>
        </view>
      </view>

      <view class="section">
        <view class="section-title">
          铭牌
        </view>
        <EmptyState
          v-if="!can.nameplates.length"
          title="等待第一张铭牌"
          description="可以先记录你的写法、释义和来源，不必一次判定唯一正解。"
          action-text="贴第一张铭牌"
          @action="focusNameplateInput"
        />
        <NameplateCard
          v-for="plate in can.nameplates"
          :key="plate.id"
          :plate="plate"
          @support="vote"
        />
        <view class="new-plate">
          <input
            v-model="newPlate.text_content"
            :focus="nameplateInputFocused"
            class="field"
            placeholder="补一张铭牌"
          >
          <textarea
            v-model="newPlate.definition"
            class="textarea"
            placeholder="说明你的判断"
          />
          <button
            class="submit"
            @tap="submitNameplate"
          >
            贴上铭牌
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import NameplateCard from '@/components/NameplateCard.vue';
import { createNameplate, getCan, voteNameplate } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import { playAudio } from '@/utils/audio';

const statusLabels = {
  unlabeled: '无标',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '争议',
  rejected: '已驳回',
};

export default {
  components: {
    EmptyState,
    NameplateCard,
  },
  data() {
    return {
      id: 0,
      can: null,
      nameplateInputFocused: false,
      newPlate: { text_content: '', definition: '' },
    };
  },
  computed: {
    primaryText() {
      return this.can.primary_nameplate ? this.can.primary_nameplate.text_content : '无标罐头';
    },
    dialectText() {
      if (this.can.dialect_detail) return this.can.dialect_detail.name;
      return [this.can.county, this.can.town].filter(Boolean).join('-') || '未标产地';
    },
  },
  async onLoad(options) {
    this.id = options.id;
    await this.refresh();
  },
  methods: {
    playAudio,
    statusText(status) {
      return statusLabels[status] || status;
    },
    async refresh() {
      this.can = await getCan(this.id);
    },
    async vote(id) {
      if (!requireAuth('nameplate_support', { page: 'can_detail', canId: this.id, nameplateId: id })) return;
      const plate = this.can.nameplates.find((item) => item.id === id);
      if (plate && plate.supported_by_current_user) return;
      await voteNameplate(id, 1);
      await this.refresh();
    },
    async submitNameplate() {
      if (!requireAuth('nameplate_create', { page: 'can_detail', canId: this.id })) return;
      if (!this.newPlate.text_content) {
        uni.showToast({ title: '请填写铭牌文字', icon: 'none' });
        return;
      }
      await createNameplate(this.id, this.newPlate);
      this.newPlate = { text_content: '', definition: '' };
      await this.refresh();
    },
    goBack() {
      uni.navigateBack();
    },
    focusNameplateInput() {
      this.nameplateInputFocused = false;
      this.$nextTick(() => {
        this.nameplateInputFocused = true;
      });
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

.hero,
.section {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 14rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.label {
  font-size: 46rpx;
  font-weight: 800;
}

.concept {
  margin-top: 10rpx;
  color: #56645b;
}

.play,
.submit {
  margin-top: 24rpx;
  background: #1f5c43;
  color: #fff;
  border-radius: 12rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 14rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  color: #425148;
  border-bottom: 1px solid #eef1eb;
}

.new-plate {
  margin-top: 22rpx;
  display: grid;
  gap: 14rpx;
}

.field,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  background: #fff;
  padding: 20rpx;
}

.textarea {
  min-height: 120rpx;
}
</style>
