<template>
  <PageShell
    :title="pageTitle"
    :show-back="false"
  >
    <view class="intro">
      <view class="step-mark">
        {{ step }}/2
      </view>
      <view class="intro-title">
        {{ stepTitle }}
      </view>
      <view class="intro-copy">
        {{ stepCopy }}
      </view>
    </view>

    <view
      v-if="step === 1"
      class="form-card"
    >
      <view class="field-label">
        怎么称呼你
      </view>
      <input
        v-model="nickname"
        class="nickname-input"
        maxlength="100"
        placeholder="输入昵称"
      >
      <view
        v-if="error"
        class="error"
      >
        {{ error }}
      </view>
      <button
        class="primary-button"
        @tap="next"
      >
        下一步 · 选主方言
      </button>
    </view>

    <view v-else>
      <view class="dialect-card">
        <view class="field-label">
          主方言（必选）
        </view>
        <view class="field-hint">
          列表来自真实方言树；选择最接近你日常乡音的节点。
        </view>
        <view
          v-if="loadingDialects"
          class="loading-copy"
        >
          正在加载方言树…
        </view>
        <template v-else>
          <view
            v-for="dialect in dialects"
            :key="dialect.id"
            :class="['dialect-option', selectedDialectId === dialect.id ? 'selected' : '']"
            :style="dialectIndent(dialect)"
            @tap="selectDialect(dialect)"
          >
            <view class="dialect-radio">
              {{ selectedDialectId === dialect.id ? '●' : '○' }}
            </view>
            <view>
              <view class="dialect-name">
                {{ dialect.name }}
              </view>
              <view class="dialect-code">
                {{ dialect.qualified_code }}
              </view>
            </view>
          </view>
        </template>
      </view>

      <view
        v-if="selectedDialectId"
        class="sample-card"
      >
        <view class="sample-kicker">
          真实乡音样本
        </view>
        <view
          v-if="loadingSample"
          class="loading-copy"
        >
          正在寻找公开录音…
        </view>
        <template v-else-if="sample">
          <view class="sample-title">
            {{ sampleTitle }}
          </view>
          <view class="sample-meta">
            {{ selectedDialectLabel }} · {{ sampleDuration }}
          </view>
          <button
            class="sample-button"
            @tap="playSample"
          >
            ▶ 试听这段乡音
          </button>
        </template>
        <view
          v-else
          class="sample-empty"
        >
          这个方言点暂时没有公开录音，仍然可以选为主方言。
        </view>
      </view>

      <view
        v-if="error"
        class="error"
      >
        {{ error }}
      </view>
      <view class="button-row">
        <button
          class="secondary-button"
          :disabled="saving"
          @tap="step = 1"
        >
          上一步
        </button>
        <button
          class="primary-button finish-button"
          :disabled="saving"
          @tap="finish"
        >
          {{ saving ? '正在保存…' : '完成设置' }}
        </button>
      </view>
    </view>

    <button
      class="logout-button"
      @tap="abandon"
    >
      退出账号，返回游客模式
    </button>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import { toFollowRecommendations } from '@/routers/user';
import {
  loadDialectSample,
  normalizeOnboardingReason,
  ONBOARDING_REASONS,
  saveDialectProfile,
} from '@/services/dialectOnboarding';
import { listAllDialects } from '@/services/guantou';
import { resumeInterruptedPageAfterLogin } from '@/services/login';
import { clearUserInfo } from '@/services/user';
import { playAudio } from '@/utils/audio';

export default {
  components: { PageShell },
  data() {
    const user = getApp().globalData.userInfo || {};
    return {
      dialects: [],
      error: '',
      loadingDialects: true,
      loadingSample: false,
      nickname: user.nickname || user.username || '',
      reason: ONBOARDING_REASONS.MISSING_DIALECT,
      sample: null,
      sampleRequestId: 0,
      saving: false,
      selectedDialectId: user.primary_dialect?.id || null,
      step: 1,
      userId: user.id || uni.getStorageSync('id'),
    };
  },
  computed: {
    isNewUser() {
      return this.reason === ONBOARDING_REASONS.NEW_USER;
    },
    pageTitle() {
      return this.isNewUser ? '欢迎加入乡声集盒' : '补选主方言';
    },
    stepTitle() {
      if (this.step === 1) return this.isNewUser ? '先认识一下' : '确认你的昵称';
      return '哪一种是你的乡音？';
    },
    stepCopy() {
      if (this.step === 1) {
        return this.isNewUser
          ? '昵称和主方言会组成你的基础方言身份。'
          : '你的账号还没有主方言，补全后才能继续贡献。';
      }
      return '主方言用于默认标注和后续个性化，不会限制你浏览其他方言。';
    },
    selectedDialect() {
      return this.dialects.find((dialect) => dialect.id === this.selectedDialectId) || null;
    },
    selectedDialectLabel() {
      return this.selectedDialect?.qualified_code || this.selectedDialect?.name || '';
    },
    sampleTitle() {
      return this.sample?.primary_nameplate?.display_text
        || this.sample?.concept_text
        || '未命名乡音';
    },
    sampleDuration() {
      const milliseconds = Number(this.sample?.duration_ms || 0);
      return milliseconds ? `${Math.max(1, Math.round(milliseconds / 1000))} 秒` : '时长未知';
    },
  },
  async onLoad(options = {}) {
    this.reason = normalizeOnboardingReason(options.reason);
    if (!this.userId) {
      uni.reLaunch({ url: '/pages/login/login' });
      return;
    }
    try {
      this.dialects = await listAllDialects();
      if (this.selectedDialectId) await this.loadSample(this.selectedDialectId);
    } finally {
      this.loadingDialects = false;
    }
  },
  onBackPress() {
    uni.showToast({ title: '请先完成主方言设置，或退出账号', icon: 'none' });
    return true;
  },
  methods: {
    dialectIndent(dialect) {
      return { paddingLeft: `${24 + Number(dialect.depth || 0) * 22}rpx` };
    },
    next() {
      const nickname = String(this.nickname || '').trim();
      if (!nickname) {
        this.error = '请输入昵称';
        return;
      }
      this.nickname = nickname;
      this.error = '';
      this.step = 2;
    },
    async selectDialect(dialect) {
      this.selectedDialectId = dialect.id;
      this.error = '';
      await this.loadSample(dialect.id);
    },
    async loadSample(dialectId) {
      const requestId = this.sampleRequestId + 1;
      this.sampleRequestId = requestId;
      this.loadingSample = true;
      try {
        const sample = await loadDialectSample(dialectId);
        if (requestId === this.sampleRequestId) this.sample = sample;
      } catch (error) {
        if (requestId === this.sampleRequestId) this.sample = null;
      } finally {
        if (requestId === this.sampleRequestId) this.loadingSample = false;
      }
    },
    playSample() {
      playAudio(this.sample?.audio_url);
    },
    async finish() {
      if (!this.selectedDialectId) {
        this.error = '请选择主方言';
        return;
      }
      this.error = '';
      this.saving = true;
      try {
        await saveDialectProfile(this.userId, {
          nickname: this.nickname,
          primaryDialectId: this.selectedDialectId,
        });
        uni.showToast({ title: '方言身份已设置', icon: 'success' });
        if (!resumeInterruptedPageAfterLogin(this.userId)) toFollowRecommendations(true);
      } finally {
        this.saving = false;
      }
    },
    abandon() {
      clearUserInfo();
      uni.reLaunch({ url: '/pages/search' });
    },
  },
};
</script>

<style scoped>
.intro {
  padding: 10rpx 4rpx 30rpx;
}

.step-mark,
.sample-kicker {
  color: #7b4f2f;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.intro-title {
  margin-top: 12rpx;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.2;
}

.intro-copy,
.field-hint {
  margin-top: 12rpx;
  color: #627067;
  font-size: 26rpx;
  line-height: 1.6;
}

.form-card,
.dialect-card,
.sample-card {
  border: 1px solid #dfe5da;
  border-radius: 16rpx;
  background: #ffffff;
  padding: 28rpx;
}

.field-label {
  color: #1d2a24;
  font-size: 29rpx;
  font-weight: 800;
}

.nickname-input {
  height: 86rpx;
  margin-top: 20rpx;
  padding: 0 22rpx;
  border: 1px solid #ccd6ca;
  border-radius: 12rpx;
  background: #f8f9f6;
  font-size: 30rpx;
}

.primary-button,
.secondary-button,
.sample-button,
.logout-button {
  border-radius: 999rpx;
  font-size: 27rpx;
}

.primary-button {
  margin-top: 28rpx;
  background: #1f5c43;
  color: #ffffff;
}

.primary-button::after,
.secondary-button::after,
.sample-button::after,
.logout-button::after {
  border: 0;
}

.loading-copy,
.sample-empty {
  padding: 28rpx 0 8rpx;
  color: #748078;
  font-size: 25rpx;
  line-height: 1.5;
}

.dialect-option {
  min-height: 86rpx;
  margin-top: 12rpx;
  padding-top: 14rpx;
  padding-right: 18rpx;
  padding-bottom: 14rpx;
  border: 1px solid #e3e8df;
  border-radius: 12rpx;
  background: #fafbf8;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-sizing: border-box;
}

.dialect-option.selected {
  border-color: #1f5c43;
  background: #edf5eb;
}

.dialect-radio {
  color: #1f5c43;
  font-size: 28rpx;
}

.dialect-name {
  font-size: 28rpx;
  font-weight: 700;
}

.dialect-code {
  margin-top: 4rpx;
  color: #748078;
  font-size: 22rpx;
}

.sample-card {
  margin-top: 20rpx;
  border-color: #eadbc9;
  background: #fffaf2;
}

.sample-title {
  margin-top: 14rpx;
  color: #32261c;
  font-size: 34rpx;
  font-weight: 800;
}

.sample-meta {
  margin-top: 8rpx;
  color: #786a5e;
  font-size: 24rpx;
}

.sample-button {
  margin: 22rpx 0 0;
  border: 1px solid #d9bea0;
  background: #ffffff;
  color: #7b4f2f;
}

.error {
  margin-top: 18rpx;
  color: #a13b2c;
  font-size: 25rpx;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16rpx;
  margin-top: 24rpx;
}

.secondary-button,
.finish-button {
  width: 100%;
  margin: 0;
}

.secondary-button {
  border: 1px solid #cbd6c9;
  background: #ffffff;
  color: #1f5c43;
}

.logout-button {
  margin: 36rpx auto 10rpx;
  background: transparent;
  color: #7b4f2f;
  font-size: 24rpx;
}
</style>
