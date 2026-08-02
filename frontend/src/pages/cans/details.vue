<template>
  <PageShell title="罐头详情">
    <template v-if="can">
      <SectionBlock>
        <view class="hero-title">
          {{ primaryText }}
        </view>
        <view class="hero-copy">
          {{ can.concept_text || '未填写普通话概念' }}
        </view>
        <button
          class="primary-button"
          @tap="playAudio(can.audio_url)"
        >
          播放乡音
        </button>
      </SectionBlock>

      <SectionBlock title="产地与状态">
        <view class="row">
          <text>方言点</text><text>{{ dialectText }}</text>
        </view>
        <view class="row">
          <text>状态</text><text>{{ statusText(can.status) }}</text>
        </view>
        <view class="row">
          <text>来源</text><text>{{ can.source_note || '未填写' }}</text>
        </view>
      </SectionBlock>

      <SectionBlock
        title="铭牌"
        :empty="!can.nameplates.length"
        empty-title="等待第一张铭牌"
        empty-description="可以先记录你的写法、释义和来源，不必一次判定唯一正解。"
        empty-action-text="贴第一张铭牌"
        @empty-action="focusNameplateInput"
      >
        <NameplateCard
          v-for="plate in can.nameplates"
          :key="plate.id"
          :plate="plate"
          @support="vote"
        />
      </SectionBlock>

      <SectionBlock title="补一张铭牌">
        <NameplateComposer
          ref="composer"
          :focus="nameplateInputFocused"
          :submitting="submittingNameplate"
          @submit="submitNameplate"
        />
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import NameplateCard from '@/components/NameplateCard.vue';
import NameplateComposer from '@/components/NameplateComposer.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
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
    NameplateCard,
    NameplateComposer,
    PageShell,
    SectionBlock,
  },
  data() {
    return {
      id: 0,
      can: null,
      nameplateInputFocused: false,
      submittingNameplate: false,
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
    async submitNameplate(payload) {
      if (!requireAuth('nameplate_create', { page: 'can_detail', canId: this.id })) return;
      this.submittingNameplate = true;
      try {
        await createNameplate(this.id, payload);
        this.$refs.composer.reset();
        await this.refresh();
      } finally {
        this.submittingNameplate = false;
      }
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
.hero-title {
  font-size: 46rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.hero-copy {
  margin-top: 10rpx;
  color: #56645b;
}

.primary-button {
  margin-top: 24rpx;
  background: #1f5c43;
  color: #ffffff;
  border-radius: 12rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0;
  color: #425148;
  border-bottom: 1px solid #eef1eb;
}
</style>
