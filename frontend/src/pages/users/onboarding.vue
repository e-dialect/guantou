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
      <BaseField
        v-model="nickname"
        class="nickname-input"
        name="nickname"
        label="怎么称呼你"
        placeholder="输入昵称"
        :maxlength="100"
        :error="error"
        @input="error = ''"
      />
      <BaseButton
        block
        @click="next"
      >
        下一步 · 选主方言
      </BaseButton>
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
          class="loading-shell loading-shell--dialects"
        >
          <BaseLoading text="正在加载方言树…" />
        </view>
        <EmptyState
          v-else-if="dialectsError"
          title="方言树加载失败"
          description="检查网络后重试；也可以先退出账号回游客模式，稍后再完成设置。"
          action-text="重新加载"
          @action="loadDialects"
        />
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
          <BaseButton
            variant="ghost"
            size="small"
            @click="playSample"
          >
            ▶ 试听这段乡音
          </BaseButton>
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
        <BaseButton
          variant="ghost"
          :disabled="saving"
          @click="step = 1"
        >
          上一步
        </BaseButton>
        <BaseButton
          :disabled="saving"
          @click="finish"
        >
          {{ saving ? '正在保存…' : '完成设置' }}
        </BaseButton>
      </view>
    </view>

    <view
      class="logout-button"
      @tap="abandon"
    >
      退出账号，返回游客模式
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import { goLogin, goSearch } from '@/services/navigation';
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
  components: {
    PageShell, BaseButton, BaseField, BaseLoading, EmptyState,
  },
  data() {
    const user = getApp().globalData.userInfo || {};
    return {
      dialects: [],
      dialectsError: false,
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
      goLogin({}, { reset: true });
      return;
    }
    await this.loadDialects();
  },
  onBackPress() {
    uni.showToast({ title: '请先完成主方言设置，或退出账号', icon: 'none' });
    return true;
  },
  methods: {
    async loadDialects() {
      this.loadingDialects = true;
      this.dialectsError = false;
      try {
        this.dialects = await listAllDialects();
        if (this.selectedDialectId) await this.loadSample(this.selectedDialectId);
      } catch (error) {
        this.dialectsError = true;
      } finally {
        this.loadingDialects = false;
      }
    },
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
      goSearch({ reset: true });
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
  color: var(--accent-color);
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
  color: var(--text-secondary-color);
  font-size: 26rpx;
  line-height: 1.6;
}

.form-card,
.dialect-card,
.sample-card {
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  padding: 28rpx;
}

.field-label {
  color: var(--text-color);
  font-size: 29rpx;
  font-weight: 800;
}

/* 方言树加载占位与列表高度对齐，避免加载完成后布局跳动 */
.loading-shell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-shell--dialects {
  min-height: 320rpx;
}

.sample-empty {
  padding: 28rpx 0 8rpx;
  color: var(--muted-color);
  font-size: 25rpx;
  line-height: 1.5;
}

.dialect-option {
  min-height: 86rpx;
  margin-top: 12rpx;
  padding-top: 14rpx;
  padding-right: 18rpx;
  padding-bottom: 14rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-color);
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-sizing: border-box;
  transition: border-color 0.2s ease, background-color 0.2s ease,
    transform 0.15s ease;
}

.dialect-option:active {
  transform: scale(0.99);
}

.dialect-option.selected {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
}

.dialect-radio {
  color: var(--accent-color);
  font-size: 28rpx;
}

.dialect-name {
  font-size: 28rpx;
  font-weight: 700;
}

.dialect-code {
  margin-top: 4rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.sample-card {
  margin-top: 20rpx;
  background: var(--accent-subtle-color);
}

.sample-title {
  margin-top: 14rpx;
  color: var(--text-color);
  font-size: 34rpx;
  font-weight: 800;
}

.sample-meta {
  margin-top: 8rpx;
  color: var(--muted-color);
  font-size: 24rpx;
}

.sample-card .base-button {
  margin-top: 22rpx;
}

.error {
  margin-top: 18rpx;
  color: var(--danger-color);
  font-size: 25rpx;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-2);
  margin-top: 24rpx;
}

.logout-button {
  margin: 36rpx auto 10rpx;
  color: var(--muted-color);
  font-size: 24rpx;
  text-align: center;
  transition: color 0.2s ease;
}

.logout-button:active {
  color: var(--danger-color);
}

@media (prefers-reduced-motion: reduce) {
  .dialect-option,
  .logout-button {
    transition: none;
  }
}
</style>
