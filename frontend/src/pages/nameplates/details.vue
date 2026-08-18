<template>
  <PageShell title="铭牌详情">
    <view
      v-if="nameplate"
      class="nameplate-page"
    >
      <view class="nameplate-hero">
        <view class="nameplate-hero__kicker">
          {{ nameplate.is_primary ? '主铭牌' : '社区铭牌' }} · {{ dialectText }}
        </view>
        <view class="nameplate-hero__writing">
          {{ nameplate.display_text }}
        </view>
        <view
          v-if="readingText"
          class="nameplate-hero__reading"
        >
          {{ readingText }}
        </view>
        <view class="nameplate-hero__definition">
          {{ nameplate.definition || '这张铭牌还没有补充释义。' }}
        </view>
      </view>

      <view class="nameplate-sheet">
        <view class="nameplate-sheet__title">
          读音记录
        </view>
        <t-cell
          title="来源原样读音"
          :note="nameplate.pronunciation_text || '未记录'"
        />
        <t-cell
          title="变化前罗马字"
          :note="nameplate.pronunciation?.base_romanization || '未记录'"
        />
        <t-cell
          title="变化后罗马字"
          :note="nameplate.pronunciation?.surface_romanization || '未记录'"
        />
        <t-cell
          title="国际音标"
          :note="nameplate.pronunciation?.ipa || '未记录'"
        />
      </view>

      <view class="nameplate-sheet">
        <view class="nameplate-sheet__title">
          立论依据
        </view>
        <t-cell
          title="方言点"
          :note="dialectText"
        />
        <t-cell
          title="证据等级"
          :note="evidenceText"
        />
        <t-cell
          title="来源类型"
          :note="sourceTypeText"
        />
        <t-cell
          v-if="sourceTitle"
          title="来源"
          :note="sourceTitle"
        />
        <view
          v-if="nameplate.source?.note"
          class="nameplate-sheet__note"
        >
          {{ nameplate.source.note }}
        </view>
      </view>

      <view class="nameplate-actions">
        <t-button
          class="support-action"
          theme="primary"
          :loading="supportBusy"
          @click="toggleSupport"
        >
          {{ supported ? '已支持' : '支持' }} {{ supportCount }}
        </t-button>
        <t-button
          class="comments-action"
          theme="light"
          @click="openComments"
        >
          评论 {{ nameplate.comment_count || 0 }}
        </t-button>
        <t-button
          class="debate-action"
          theme="danger"
          variant="outline"
          @click="openDebate"
        >
          立论
        </t-button>
      </view>

      <view
        class="can-link"
        @tap="openCan"
      >
        <view class="can-link__label">
          这张铭牌所解释的录音
        </view>
        <view class="can-link__value">
          播放罐头并查看录音者信息 ›
        </view>
      </view>
    </view>
    <t-loading
      v-else
      text="正在取出铭牌"
    />
  </PageShell>
</template>

<script>
import TButton from '@tdesign/uniapp/button/button.vue';
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TLoading from '@tdesign/uniapp/loading/loading.vue';
import PageShell from '@/components/PageShell.vue';
import { getNameplate, supportNameplate, unsupportNameplate } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import {
  goCanDetail,
  goCreateNameplate,
  goNameplateComments,
} from '@/services/navigation';

const SOURCE_LABELS = {
  creator: '创作者自述',
  oral: '口述',
  fieldwork: '田野记录',
  book: '书籍',
  article: '论文 / 文章',
  archive: '档案',
  web: '网页',
  other: '其他',
};
const EVIDENCE_LABELS = {
  1: '本人记忆', 2: '社区公认', 3: '文献考据', 4: '官方认证',
};

export default {
  components: {
    PageShell,
    TButton,
    TCell,
    TLoading,
  },
  data() {
    return {
      id: null,
      nameplate: null,
      supported: false,
      supportCount: 0,
      supportBusy: false,
      resumeAction: '',
    };
  },
  computed: {
    dialectText() {
      return this.nameplate?.dialect?.name || '方言点待补';
    },
    readingText() {
      const pronunciation = this.nameplate?.pronunciation || {};
      const base = pronunciation.base_romanization || '';
      const surface = pronunciation.surface_romanization
        || this.nameplate?.pronunciation_text || pronunciation.ipa || '';
      if (base && surface && base !== surface) return `${base} → ${surface}`;
      return surface || base;
    },
    evidenceText() {
      return EVIDENCE_LABELS[this.nameplate?.evidence_level] || '未说明';
    },
    sourceTypeText() {
      const type = this.nameplate?.source_type || this.nameplate?.source?.type || 'other';
      return SOURCE_LABELS[type] || SOURCE_LABELS.other;
    },
    sourceTitle() {
      const source = this.nameplate?.source || {};
      return source.title || source.attributed_to || source.url || '';
    },
  },
  onLoad(options) {
    this.id = Number(options.id);
    this.resumeAction = options.resume || '';
    this.load();
  },
  methods: {
    async load() {
      this.nameplate = await getNameplate(this.id);
      this.supported = Boolean(this.nameplate.supported_by_current_user);
      this.supportCount = Number(this.nameplate.support_count || 0);
      if (this.resumeAction === 'support' && !this.supported) {
        this.resumeAction = '';
        await this.toggleSupport();
      }
    },
    async toggleSupport() {
      if (!this.supported && !requireAuth('nameplate_support', {
        nameplateId: this.id,
        canId: this.nameplate.can?.id,
      })) return;
      if (this.supportBusy) return;
      this.supportBusy = true;
      try {
        const result = this.supported
          ? await unsupportNameplate(this.id)
          : await supportNameplate(this.id);
        this.supported = Boolean(result.supported_by_current_user);
        this.supportCount = Number(result.support_count || 0);
      } finally {
        this.supportBusy = false;
      }
    },
    openComments() {
      goNameplateComments(this.id);
    },
    openDebate() {
      if (!requireAuth('nameplate_create', {
        nameplateId: this.id,
        canId: this.nameplate.can?.id,
      })) return;
      goCreateNameplate(this.nameplate.can.id, this.id);
    },
    openCan() {
      goCanDetail(this.nameplate.can.id);
    },
  },
};
</script>

<style scoped>
.nameplate-page { padding-bottom: 60rpx; }
.nameplate-hero {
  position: relative;
  padding: 44rpx 34rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  background: var(--surface-color);
  box-shadow: 0 18rpx 48rpx var(--border-color);
}
.nameplate-hero::after {
  content: '铭牌';
  position: absolute;
  right: 28rpx;
  top: 28rpx;
  padding: 8rpx;
  border: 2rpx solid var(--danger-color);
  color: var(--danger-color);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  transform: rotate(4deg);
}
.nameplate-hero__kicker {
  color: var(--accent-color);
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}
.nameplate-hero__writing {
  margin-top: 18rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 76rpx;
  font-weight: 900;
  line-height: 1.2;
}
.nameplate-hero__reading {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  font-size: 30rpx;
  letter-spacing: 3rpx;
}
.nameplate-hero__definition {
  margin-top: 24rpx;
  color: var(--text-secondary-color);
  font-size: 28rpx;
  line-height: 1.7;
}
.nameplate-sheet {
  margin-top: 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}
.nameplate-sheet__title {
  padding: 22rpx 26rpx 10rpx;
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
.nameplate-sheet__note {
  padding: 22rpx 28rpx;
  color: var(--muted-text-color);
  font-size: 24rpx;
  line-height: 1.6;
}
.nameplate-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14rpx;
  margin-top: 28rpx;
}
.can-link {
  margin-top: 26rpx;
  padding: 24rpx 28rpx;
  border-left: 7rpx solid var(--accent-color);
  background: var(--surface-color);
}
.can-link__label { color: var(--muted-text-color); font-size: 21rpx; }
.can-link__value {
  margin-top: 8rpx;
  color: var(--text-color);
  font-size: 27rpx;
  font-weight: 800;
}
</style>
