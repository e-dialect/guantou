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
        <view
          v-for="plate in can.nameplates"
          :key="plate.id"
          class="plate"
        >
          <view class="plate-title">
            <text>{{ plate.text_content }}</text>
            <text
              v-if="plate.is_primary"
              class="primary"
            >
              主铭牌
            </text>
          </view>
          <view class="plate-def">
            {{ plate.definition || '暂无释义' }}
          </view>
          <button
            class="vote"
            :disabled="plate.supported_by_current_user"
            @tap="vote(plate.id)"
          >
            {{ plate.supported_by_current_user ? '已支持' : '支持这张铭牌' }} · {{ plate.weight }}
          </button>
        </view>
        <view class="new-plate">
          <input
            v-model="newPlate.text_content"
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
import { createNameplate, getCan, voteNameplate } from '@/services/guantou';
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
  data() {
    return {
      id: 0,
      can: null,
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
      const plate = this.can.nameplates.find((item) => item.id === id);
      if (plate && plate.supported_by_current_user) return;
      await voteNameplate(id, 1);
      await this.refresh();
    },
    async submitNameplate() {
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

.plate {
  padding: 18rpx 0;
  border-bottom: 1px solid #eef1eb;
}

.plate-title {
  display: flex;
  justify-content: space-between;
  font-size: 32rpx;
  font-weight: 700;
}

.primary {
  color: #1f5c43;
  font-size: 24rpx;
  background: #e8f1eb;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}

.plate-def {
  margin-top: 8rpx;
  color: #56645b;
}

.vote {
  margin: 14rpx 0 0;
  font-size: 24rpx;
  background: #fff;
  border: 1px solid #cbd5c5;
  color: #2f4638;
}

.vote[disabled] {
  color: #7a867d;
  background: #f3f5f1;
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
