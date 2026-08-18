<template>
  <PageShell title="乡音表达">
    <view
      v-if="loading"
      class="state-card"
    >
      正在加载表达…
    </view>
    <view
      v-else-if="loadError"
      class="state-card error"
    >
      <view>{{ loadError }}</view>
      <button @tap="loadPost">
        重试
      </button>
    </view>
    <template v-else-if="post">
      <SectionBlock>
        <view class="author-row">
          <image
            class="avatar"
            :src="post.author.avatar"
            mode="aspectFill"
          />
          <view>
            <view class="author-name">
              {{ post.author.nickname || post.author.username }}
            </view>
            <view class="created-at">
              {{ formatTime(post.created_at) }}
            </view>
          </view>
        </view>
        <view class="post-text">
          {{ post.text || '用这段乡音表达了一次' }}
        </view>
      </SectionBlock>

      <SectionBlock title="使用的罐头">
        <view
          v-if="post.source.source_unavailable"
          class="source-warning"
        >
          原罐头已不可查看，以下为发布时保留的来源摘要。
        </view>
        <view class="source-title">
          {{ sourceLabel }}
        </view>
        <view class="source-concept">
          {{ post.can.concept_text || '未填写普通话概念' }}
        </view>
        <view class="source-byline">
          使用了 @{{ sourceRecorderName }} 的罐头
        </view>
        <button
          class="listen-button"
          :disabled="!post.can.audio_url"
          @tap="playAudio(post.can.audio_url)"
        >
          ▶ 播放完整乡音
        </button>
        <view class="action-grid">
          <button
            :disabled="post.source.source_unavailable"
            @tap="toSourceCan"
          >
            查看原罐
          </button>
          <button @tap="useSame">
            我也用同款
          </button>
          <button
            open-type="share"
            @tap="shareCurrent"
          >
            分享
          </button>
        </view>
      </SectionBlock>

      <SectionBlock
        v-if="post.can.primary_nameplate"
        title="关联词典"
      >
        <view class="dictionary-card">
          <view class="source-title">
            {{ post.can.primary_nameplate.display_text }}
          </view>
          <view class="source-concept">
            {{ post.can.primary_nameplate.definition || post.can.concept_text }}
          </view>
          <view class="dictionary-actions">
            <button
              v-if="post.can.primary_nameplate.package"
              @tap="toPackage(post.can.primary_nameplate.package.id)"
            >
              查看写法
            </button>
            <button
              v-if="post.can.primary_nameplate.flavor"
              @tap="toFlavor(post.can.primary_nameplate.flavor.id)"
            >
              查看义项
            </button>
          </view>
        </view>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { goCanDetail, goFlavorDetail, goPackageDetail } from '@/services/navigation';
import { getCanPost } from '@/services/canSocial';
import { startUseSame } from '@/services/canPostJourney';
import { playAudio } from '@/utils/audio';

export default {
  components: { PageShell, SectionBlock },
  data() {
    return {
      id: 0,
      loadError: '',
      loading: true,
      post: null,
    };
  },
  computed: {
    sourceLabel() {
      return this.post.can.primary_nameplate?.display_text || '无标罐头';
    },
    sourceRecorderName() {
      const recorder = this.post.source.recorder || this.post.can.recorder || {};
      return recorder.nickname || recorder.username || '原作者';
    },
  },
  async onLoad(options = {}) {
    this.id = Number(options.id || 0);
    await this.loadPost();
  },
  onShareAppMessage() {
    return {
      title: this.post?.text || '听听这段乡音表达',
      path: `/pages/posts/details?id=${this.id}`,
    };
  },
  methods: {
    playAudio,
    formatTime(value) {
      return String(value || '').replace('T', ' ').slice(0, 16);
    },
    async loadPost() {
      this.loading = true;
      this.loadError = '';
      try {
        this.post = await getCanPost(this.id);
      } catch (error) {
        this.loadError = error.message || '表达不存在或暂不可见';
      } finally {
        this.loading = false;
      }
    },
    toSourceCan() {
      if (this.post.source.source_unavailable) return;
      goCanDetail(this.post.source.can_id);
    },
    useSame() {
      startUseSame(this.post.source.can_id, {
        page: 'post_detail',
        postId: this.post.id,
      });
    },
    toPackage(id) {
      goPackageDetail(id);
    },
    toFlavor(id) {
      goFlavorDetail(id);
    },
    async shareCurrent() {
      // #ifdef H5
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({ title: '乡音表达', url });
      } else {
        await navigator.clipboard.writeText(url);
        uni.showToast({ title: '链接已复制', icon: 'success' });
      }
      // #endif
    },
  },
};
</script>

<style scoped>
.state-card {
  box-sizing: border-box;
  width: 100%;
  padding: 32rpx;
  border: 1px solid #dfe5db;
  border-radius: 14rpx;
  background: #fff;
  color: #617067;
}

.state-card.error,
.source-warning {
  color: #934438;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #e7ebe4;
}

.author-name,
.source-title {
  font-weight: 800;
}

.created-at,
.source-concept,
.source-byline {
  margin-top: 6rpx;
  color: #6d7b72;
  font-size: 24rpx;
}

.post-text {
  margin-top: 24rpx;
  color: #26372e;
  font-size: 32rpx;
  line-height: 1.6;
  white-space: pre-wrap;
}

.source-warning {
  margin-bottom: 18rpx;
  padding: 14rpx;
  border-radius: 10rpx;
  background: #faede9;
  font-size: 24rpx;
}

.source-title {
  font-size: 36rpx;
}

.listen-button {
  margin-top: 20rpx;
  border-radius: 12rpx;
  background: #1f5c43;
  color: #fff;
}

.action-grid,
.dictionary-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 16rpx;
}

.action-grid button,
.dictionary-actions button {
  margin: 0;
  background: #edf1eb;
  color: #415248;
  font-size: 24rpx;
}

.dictionary-actions {
  grid-template-columns: 1fr 1fr;
}
</style>
