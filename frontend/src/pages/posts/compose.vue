<template>
  <PageShell title="用同款发布">
    <view
      v-if="loading"
      class="state-card"
    >
      正在带入乡音罐头…
    </view>
    <view
      v-else-if="loadError"
      class="state-card error"
    >
      <view>{{ loadError }}</view>
      <button @tap="loadCan">
        重试
      </button>
    </view>
    <template v-else-if="can">
      <SectionBlock title="已带入的乡音">
        <view class="source-label">
          {{ sourceLabel }}
        </view>
        <view class="source-concept">
          {{ can.concept_text || '未填写普通话概念' }}
        </view>
        <view class="source-meta">
          {{ can.recorder.nickname || can.recorder.username }} ·
          {{ can.submitted_dialect?.qualified_code || '未标方言点' }}
        </view>
        <button
          class="listen-button"
          @tap="playAudio(can.audio_url)"
        >
          ▶ 试听原罐头
        </button>
      </SectionBlock>

      <SectionBlock title="补一句自己的表达">
        <textarea
          v-model="text"
          class="post-input"
          maxlength="500"
          placeholder="可选，例如：我家也这样说"
          :focus="true"
        />
        <view class="counter">
          {{ text.length }}/500
        </view>
        <view class="visibility-row">
          <button
            :class="['visibility-button', { active: visibility === 'public' }]"
            @tap="visibility = 'public'"
          >
            公开
          </button>
          <button
            :class="['visibility-button', { active: visibility === 'private' }]"
            @tap="visibility = 'private'"
          >
            仅自己
          </button>
        </view>
        <button
          class="publish-button"
          :disabled="submitting"
          @tap="publish"
        >
          {{ submitting ? '发布中…' : '发布表达' }}
        </button>
        <view class="hint">
          每条表达都必须保留这段罐头来源，不支持纯文字发布。
        </view>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { createCanPost } from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';
import { getCan } from '@/services/guantou';
import { playAudio } from '@/utils/audio';

export default {
  components: { PageShell, SectionBlock },
  data() {
    return {
      can: null,
      canId: 0,
      loadError: '',
      loading: true,
      submitting: false,
      text: '',
      visibility: 'public',
    };
  },
  computed: {
    sourceLabel() {
      return this.can.primary_nameplate?.display_text || '无标罐头';
    },
  },
  async onLoad(options = {}) {
    this.canId = Number(options.can_id || 0);
    if (!this.canId) {
      this.loading = false;
      this.loadError = '缺少要引用的罐头';
      return;
    }
    if (!requireAuth('use_same', { page: 'post_compose', canId: this.canId })) return;
    await this.loadCan();
  },
  methods: {
    playAudio,
    async loadCan() {
      this.loading = true;
      this.loadError = '';
      try {
        this.can = await getCan(this.canId);
      } catch (error) {
        this.loadError = error.message || '罐头加载失败';
      } finally {
        this.loading = false;
      }
    },
    async publish() {
      if (this.submitting || !this.can) return;
      this.submitting = true;
      try {
        const post = await createCanPost(this.canId, this.text, this.visibility);
        uni.showToast({ title: '发布成功', icon: 'success' });
        uni.redirectTo({ url: `/pages/posts/details?id=${post.id}` });
      } catch (error) {
        uni.showToast({ title: error.message || '发布失败', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.state-card,
.post-input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #dfe5db;
  border-radius: 14rpx;
  background: #fff;
}

.state-card {
  padding: 32rpx;
  color: #617067;
}

.state-card.error {
  color: #934438;
}

.source-label {
  font-size: 38rpx;
  font-weight: 800;
}

.source-concept,
.source-meta,
.hint,
.counter {
  margin-top: 10rpx;
  color: #68766e;
}

.listen-button,
.publish-button {
  margin-top: 22rpx;
  border-radius: 12rpx;
  background: #1f5c43;
  color: #fff;
}

.post-input {
  min-height: 220rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.counter {
  text-align: right;
  font-size: 22rpx;
}

.visibility-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 18rpx;
}

.visibility-button {
  margin: 0;
  background: #edf1eb;
  color: #58675e;
  font-size: 25rpx;
}

.visibility-button.active {
  background: #dcebe1;
  color: #164b36;
  font-weight: 800;
}

.hint {
  font-size: 22rpx;
  text-align: center;
}
</style>
