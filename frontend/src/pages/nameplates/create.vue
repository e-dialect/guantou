<template>
  <PageShell title="发表立论">
    <view class="create-page">
      <view class="create-page__notice">
        <view class="create-page__notice-title">
          一张新铭牌，一种可追溯的说法
        </view>
        <view class="create-page__notice-copy">
          你的立论会与现有铭牌并列呈现，不会覆盖或修改别人的记录。
        </view>
      </view>

      <view
        v-if="reference"
        class="reference-card"
      >
        <view class="reference-card__label">
          参考中的铭牌
        </view>
        <view class="reference-card__writing">
          {{ reference.display_text }}
        </view>
        <view class="reference-card__copy">
          {{ reference.definition || '暂无释义' }}
        </view>
      </view>

      <view class="form-sheet">
        <view class="form-sheet__title">
          你的主张
        </view>
        <t-input
          v-model="form.text_content"
          label="写作"
          placeholder="例如：刣 / 杀"
          maxlength="160"
        />
        <t-input
          v-model="form.pronunciation_text"
          label="实际读音"
          placeholder="可填写来源原样罗马字或 IPA"
          maxlength="160"
        />
        <t-textarea
          v-model="form.definition"
          label="释义"
          placeholder="说明这个词在本地方言里的意思和用法"
          maxlength="1000"
          indicator
          autosize
        />
      </view>

      <view class="form-sheet">
        <view class="form-sheet__title">
          方言与依据
        </view>
        <picker
          :range="dialectLabels"
          :value="dialectIndex"
          @change="chooseDialect"
        >
          <t-cell
            title="方言点"
            :note="selectedDialect?.name || '请选择'"
            arrow
          />
        </picker>
        <picker
          :range="sourceLabels"
          :value="sourceIndex"
          @change="chooseSource"
        >
          <t-cell
            title="来源类型"
            :note="sourceLabels[sourceIndex]"
            arrow
          />
        </picker>
        <t-input
          v-model="form.source.title"
          label="来源名称"
          placeholder="书名、文章名或资料名称（选填）"
        />
        <t-input
          v-model="form.source.attributed_to"
          label="提供者"
          placeholder="口述者、作者或整理者（选填）"
        />
        <t-input
          v-model="form.source.locator"
          label="定位"
          placeholder="页码、条目号等（选填）"
        />
        <t-textarea
          v-model="form.source.note"
          label="补充说明"
          placeholder="记录判断依据，方便后来者复核"
          autosize
        />
      </view>

      <t-button
        block
        theme="primary"
        size="large"
        :loading="submitting"
        @tap="submit"
      >
        发表这张铭牌
      </t-button>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import {
  createNameplate,
  getNameplate,
  listAllDialects,
} from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';
import { goHome, goNameplateDetail } from '@/services/navigation';

const SOURCE_OPTIONS = [
  { value: 'creator', label: '创作者自述' },
  { value: 'oral', label: '口述' },
  { value: 'fieldwork', label: '田野记录' },
  { value: 'book', label: '书籍' },
  { value: 'article', label: '论文 / 文章' },
  { value: 'archive', label: '档案' },
  { value: 'web', label: '网页' },
  { value: 'other', label: '其他' },
];

export default {
  components: { PageShell },
  data() {
    return {
      canId: null,
      referenceId: null,
      reference: null,
      dialects: [],
      dialectIndex: 0,
      sourceIndex: 0,
      submitting: false,
      form: {
        text_content: '',
        pronunciation_text: '',
        definition: '',
        source: {
          title: '', attributed_to: '', locator: '', note: '',
        },
      },
    };
  },
  computed: {
    dialectLabels() {
      return this.dialects.map((item) => item.qualified_code || item.name);
    },
    selectedDialect() {
      return this.dialects[this.dialectIndex] || null;
    },
    sourceLabels() {
      return SOURCE_OPTIONS.map((item) => item.label);
    },
  },
  onLoad(options) {
    this.canId = Number(options.can_id);
    this.referenceId = options.reference_id ? Number(options.reference_id) : null;
    if (!this.canId || !requireAuth('nameplate_create', {
      canId: this.canId,
      nameplateId: this.referenceId,
    })) {
      if (!this.canId) goHome(true);
      return;
    }
    this.loadContext();
  },
  methods: {
    async loadContext() {
      const [dialects, reference] = await Promise.all([
        listAllDialects(),
        this.referenceId ? getNameplate(this.referenceId) : Promise.resolve(null),
      ]);
      this.dialects = dialects;
      this.reference = reference;
      const referenceDialectId = reference?.dialect?.id;
      const matchedIndex = this.dialects.findIndex((item) => item.id === referenceDialectId);
      if (matchedIndex >= 0) this.dialectIndex = matchedIndex;
    },
    chooseDialect(event) {
      this.dialectIndex = Number(event.detail.value);
    },
    chooseSource(event) {
      this.sourceIndex = Number(event.detail.value);
    },
    async submit() {
      const writing = String(this.form.text_content || '').trim();
      const reading = String(this.form.pronunciation_text || '').trim();
      if (!writing && !reading) {
        uni.showToast({ title: '写法或实际读音至少填写一项', icon: 'none' });
        return;
      }
      this.submitting = true;
      try {
        const sourceOption = SOURCE_OPTIONS[this.sourceIndex];
        const source = Object.fromEntries(Object.entries({
          type: sourceOption.value,
          ...this.form.source,
        }).filter(([, value]) => String(value || '').trim()));
        const created = await createNameplate(this.canId, {
          text_content: writing,
          pronunciation_text: reading,
          definition: String(this.form.definition || '').trim(),
          dialect_id: this.selectedDialect?.id,
          evidence_level: sourceOption.value === 'creator' ? 1 : 2,
          source,
        });
        uni.showToast({ title: '铭牌已发表', icon: 'success' });
        goNameplateDetail(created.id, {}, { replace: true });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.create-page { padding-bottom: 70rpx; }
.create-page__notice {
  padding: 28rpx 30rpx;
  border: 1rpx solid var(--border-color);
  border-left: 8rpx solid var(--accent-color);
  border-radius: 6rpx;
  background: var(--accent-subtle-color);
}
.create-page__notice-title {
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: 31rpx;
  font-weight: 900;
}
.create-page__notice-copy {
  margin-top: 10rpx;
  color: var(--text-secondary-color);
  font-size: 23rpx;
  line-height: 1.6;
}
.reference-card {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
  border: 1rpx dashed var(--border-color);
  background: var(--surface-color);
}
.reference-card__label {
  color: var(--danger-color);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}
.reference-card__writing {
  margin-top: 8rpx;
  color: var(--text-color);
  font-family: STKaiti, KaiTi, serif;
  font-size: 44rpx;
  font-weight: 900;
}
.reference-card__copy { margin-top: 8rpx; color: var(--text-secondary-color); font-size: 23rpx; }
.form-sheet {
  margin: 24rpx 0;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}
.form-sheet__title {
  padding: 24rpx 28rpx 12rpx;
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
</style>
