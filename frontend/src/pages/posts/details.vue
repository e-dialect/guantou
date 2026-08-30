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
      <button
        class="retry-button"
        hover-class="page-button--pressed"
        @tap="loadPost"
      >
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
          hover-class="page-button--pressed"
          @tap="playAudio(post.can.audio_url)"
        >
          ▶ 播放完整乡音
        </button>
        <view class="action-grid">
          <button
            :disabled="post.source.source_unavailable"
            hover-class="page-button--pressed"
            @tap="toSourceCan"
          >
            查看原罐
          </button>
          <button
            hover-class="page-button--pressed"
            @tap="useSame"
          >
            我也用同款
          </button>
          <button
            open-type="share"
            hover-class="page-button--pressed"
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
              hover-class="page-button--pressed"
              @tap="toPackage(post.can.primary_nameplate.package.id)"
            >
              查看写法
            </button>
            <button
              v-if="post.can.primary_nameplate.flavor"
              hover-class="page-button--pressed"
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
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  color: var(--muted-color);
  transition: opacity 0.15s ease;
}

.state-card.error,
.source-warning {
  color: var(--danger-color);
}

.source-warning {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--danger-subtle-color);
  font-size: var(--font-size-xs);
}

.retry-button {
  margin: var(--space-3) 0 0;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.author-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.author-name,
.source-title {
  color: var(--text-color);
  font-weight: 800;
}

.source-title {
  font-size: var(--font-size-xl);
}

.created-at,
.source-concept,
.source-byline {
  margin-top: 6rpx;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.post-text {
  margin-top: var(--space-3);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  line-height: 1.6;
  white-space: pre-wrap;
}

.listen-button {
  margin-top: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent-color);
  color: var(--on-accent-color);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.listen-button[disabled] {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.action-grid,
.dictionary-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.action-grid button,
.dictionary-actions button,
.retry-button {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.action-grid button,
.dictionary-actions button {
  margin: 0;
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}

.dictionary-actions {
  grid-template-columns: 1fr 1fr;
}

.page-button--pressed {
  transform: scale(0.98);
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .state-card,
  .listen-button,
  .action-grid button,
  .dictionary-actions button,
  .retry-button {
    transition: none;
  }
}
</style>
