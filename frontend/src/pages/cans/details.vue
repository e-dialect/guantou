<template>
  <PageShell title="罐头详情">
    <template v-if="can">
      <view class="can-hero immersive-shell">
        <view class="can-hero__eyebrow">
          录音罐头 · #{{ can.id }}
        </view>
        <view class="can-hero__title">
          {{ primaryText }}
        </view>
        <view class="can-hero__meta">
          {{ dialectText }} · {{ durationText }} · {{ formatTime(can.created_at) }}
        </view>
        <view
          v-if="can.recorder"
          class="recorder"
          @tap="toRecorder"
        >
          <image
            v-if="can.recorder.avatar"
            class="recorder__avatar"
            :src="can.recorder.avatar"
            mode="aspectFill"
          />
          <view
            v-else
            class="recorder__avatar recorder__avatar--empty"
          />
          <view class="recorder__body">
            <view class="recorder__label">
              录音人
            </view>
            <view class="recorder__name">
              {{ can.recorder.nickname || can.recorder.username }}
            </view>
          </view>
          <text class="recorder__link">
            主页 ›
          </text>
        </view>
        <t-button
          block
          theme="primary"
          size="large"
          @click="playAudio(can.audio_url)"
        >
          播放这段乡音
        </t-button>
        <view class="can-hero__actions">
          <t-button
            theme="light"
            :loading="likeBusy"
            @click="toggleLike"
          >
            {{ can.liked_by_me ? '已点赞' : '点赞' }} {{ can.like_count || 0 }}
          </t-button>
          <t-button
            theme="light"
            @click="useSame"
          >
            用同款 {{ can.use_count || 0 }}
          </t-button>
          <t-button
            theme="light"
            open-type="share"
            @click="shareCurrent"
          >
            分享
          </t-button>
        </view>
      </view>

      <SectionBlock title="录音档案">
        <t-cell
          title="方言提示"
          :note="can.submitted_dialect?.qualified_code || '未记录'"
        />
        <t-cell
          title="当前状态"
          :note="statusText(can.status)"
        />
        <t-cell
          title="来源说明"
          :note="can.source_note || '未填写'"
        />
        <view
          v-if="transitionActions.length"
          class="review-box"
        >
          <t-textarea
            v-model="transitionReason"
            maxlength="300"
            placeholder="流转理由（驳回时建议填写）"
            autosize
          />
          <view class="review-actions">
            <t-button
              v-for="item in transitionActions"
              :key="item.action"
              size="small"
              :theme="item.action === 'reject' ? 'danger' : 'primary'"
              :loading="transitionBusy === item.action"
              @click="runTransition(item.action)"
            >
              {{ item.label }}
            </t-button>
          </view>
        </view>
      </SectionBlock>

      <SectionBlock title="这段录音的铭牌">
        <view class="section-intro">
          写法、释义和读音变化属于铭牌。点开铭牌可查看完整来源与讨论。
        </view>
        <NameplateCard
          v-for="plate in activeNameplates"
          :key="plate.id"
          :plate="plate"
          @open="openNameplate"
          @comments="openNameplateComments"
          @debate="openDebate"
          @support="support"
          @unsupport="unsupport"
        />
        <t-empty
          v-if="!activeNameplates.length"
          description="这段录音还没有铭牌"
        />
        <t-button
          block
          variant="outline"
          theme="primary"
          @click="createPlate"
        >
          {{ activeNameplates.length ? '发表一张新铭牌' : '补上第一张铭牌' }}
        </t-button>
      </SectionBlock>

      <SectionBlock :title="`录音评论 · ${can.comment_count || 0}`">
        <view class="section-intro">
          这里讨论录音与录制信息；关于具体写法和读音，请进入对应铭牌评论区。
        </view>
        <t-button
          block
          theme="light"
          @click="openCanComments"
        >
          查看罐头评论
        </t-button>
      </SectionBlock>

      <SectionBlock :title="`引用表达 · ${can.use_count || posts.length}`">
        <t-empty
          v-if="!posts.length"
          description="还没有人用这段乡音表达"
        />
        <view
          v-for="post in posts"
          :key="post.id"
          class="post-row"
          @tap="toPost(post.id)"
        >
          <view class="post-row__author">
            {{ post.author.nickname || post.author.username }}
          </view>
          <view class="post-row__text">
            {{ post.text || '用这段乡音表达了一次' }}
          </view>
          <view class="post-row__time">
            {{ formatTime(post.created_at) }} · 查看表达 ›
          </view>
        </view>
      </SectionBlock>
    </template>
    <t-loading
      v-else
      text="正在开罐"
    />
  </PageShell>
</template>

<script>
import TButton from '@tdesign/uniapp/button/button.vue';
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TLoading from '@tdesign/uniapp/loading/loading.vue';
import NameplateCard from '@/components/NameplateCard.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import {
  getCan, supportNameplate, transitionCan, unsupportNameplate,
} from '@/services/guantou';
import { likeCan, unlikeCan } from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';
import { openCanPost, startUseSame } from '@/services/canPostJourney';
import {
  goCanComments,
  goCreateNameplate,
  goNameplateComments,
  goNameplateDetail,
} from '@/services/navigation';
import { playAudio } from '@/utils/audio';
import { toUserPage } from '@/routers/user';
import { canSharePayload, shareCanOnWeb } from '@/utils/shareCan';

const statusLabels = {
  unlabeled: '无标',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '争议',
  rejected: '已驳回',
};
const transitionLabels = {
  submit: '提交校验', verify: '审核通过', reject: '驳回', dispute: '提出争议', restore: '恢复待校验',
};

export function availableCanTransitions(can, user) {
  if (!can || !user || !user.id) return [];
  const isOwner = Number(can.recorder?.id) === Number(user.id);
  const actions = [];
  if (isOwner && can.status === 'pending') actions.push('submit');
  if (isOwner && can.status === 'tentative') actions.push('dispute');
  if ((isOwner || user.is_staff) && can.status === 'rejected') actions.push('restore');
  if (user.is_staff && ['tentative', 'disputed'].includes(can.status)) actions.push('verify');
  if (user.is_staff && ['pending', 'tentative', 'disputed'].includes(can.status)) actions.push('reject');
  return actions.map((action) => ({ action, label: transitionLabels[action] }));
}

function currentSessionUser() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const storedId = typeof uni !== 'undefined' && uni.getStorageSync ? uni.getStorageSync('id') : null;
  return {
    id: app?.globalData?.userInfo?.id || storedId || null,
    is_staff: Boolean(app?.globalData?.userInfo?.is_staff),
  };
}

export default {
  components: {
    NameplateCard,
    PageShell,
    SectionBlock,
    TButton,
    TCell,
    TLoading,
  },
  data() {
    return {
      id: 0,
      can: null,
      currentUser: currentSessionUser(),
      likeBusy: false,
      posts: [],
      transitionBusy: '',
      transitionReason: '',
    };
  },
  computed: {
    activeNameplates() {
      return [...(this.can?.nameplates || [])]
        .filter((plate) => plate.status === 'active')
        .sort((left, right) => (
          Number(right.is_primary) - Number(left.is_primary)
          || right.weight - left.weight
        ));
    },
    primaryText() {
      return this.activeNameplates[0]?.display_text || '无标罐头';
    },
    dialectText() {
      return this.activeNameplates[0]?.dialect?.qualified_code
        || this.can?.submitted_dialect?.qualified_code || '未标方言点';
    },
    durationText() {
      const seconds = Math.round(Number(this.can?.duration_ms || 0) / 1000);
      return seconds ? `${seconds} 秒` : '时长未记录';
    },
    transitionActions() { return availableCanTransitions(this.can, this.currentUser); },
  },
  async onLoad(options) {
    this.id = Number(options.id);
    await this.refresh();
  },
  onShow() { this.currentUser = currentSessionUser(); },
  onShareAppMessage() { return canSharePayload(this.can || { id: this.id }); },
  methods: {
    playAudio,
    statusText(status) { return statusLabels[status] || status; },
    formatTime(value) { return String(value || '').replace('T', ' ').slice(0, 16); },
    async refresh() {
      this.can = await getCan(this.id);
      this.posts = this.can.recent_posts || [];
    },
    async runTransition(action) {
      if (this.transitionBusy) return;
      this.transitionBusy = action;
      try {
        const updated = await transitionCan(this.can.id, action, this.transitionReason);
        this.can = updated;
        this.transitionReason = '';
        uni.showToast({ title: '状态已更新', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '状态更新失败', icon: 'none' });
      } finally { this.transitionBusy = ''; }
    },
    async toggleLike() {
      if (
        !requireAuth('like', { page: 'can_detail', canId: this.id })
        || this.likeBusy
      ) return;
      this.likeBusy = true;
      try {
        const response = this.can.liked_by_me ? await unlikeCan(this.id) : await likeCan(this.id);
        this.can.liked_by_me = response.liked;
        this.can.like_count = response.like_count;
      } finally { this.likeBusy = false; }
    },
    toRecorder() { if (this.can.recorder?.id) toUserPage(this.can.recorder.id); },
    async shareCurrent() {
      // #ifdef H5
      await shareCanOnWeb(this.can);
      // #endif
    },
    useSame() { startUseSame(this.id, { page: 'can_detail' }); },
    toPost(postId) { openCanPost(postId); },
    openCanComments() { goCanComments(this.id); },
    openNameplate(id) { goNameplateDetail(id); },
    openNameplateComments(id) { goNameplateComments(id); },
    openDebate(plate) {
      if (!requireAuth('nameplate_create', { canId: this.id, nameplateId: plate.id })) return;
      goCreateNameplate(this.id, plate.id);
    },
    createPlate() {
      const referenceId = this.activeNameplates[0]?.id || null;
      if (!requireAuth('nameplate_create', { canId: this.id, nameplateId: referenceId })) return;
      goCreateNameplate(this.id, referenceId);
    },
    async support(id) {
      if (!requireAuth('nameplate_support', { canId: this.id, nameplateId: id })) return;
      await supportNameplate(id);
      await this.refresh();
    },
    async unsupport(id) {
      await unsupportNameplate(id);
      await this.refresh();
    },
  },
};
</script>

<style scoped>
.can-hero {
  padding: 34rpx;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    145deg,
    var(--immersive-bg-soft-color),
    var(--immersive-bg-strong-color)
  );
  color: var(--on-immersive-color);
  box-shadow: 0 20rpx 54rpx var(--immersive-veil-color);
}
.can-hero__eyebrow {
  color: var(--immersive-accent-color);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
}
.can-hero__title {
  margin-top: 14rpx;
  font-family: STKaiti, KaiTi, serif;
  font-size: 56rpx;
  font-weight: 900;
}
.can-hero__meta {
  margin-top: 10rpx;
  color: var(--on-immersive-muted-color);
  font-size: 22rpx;
}
.recorder {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 28rpx 0 24rpx;
  padding: 18rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: 8rpx;
  background: var(--immersive-surface-color);
}
.recorder__avatar {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--immersive-surface-strong-color);
}
.recorder__body { flex: 1; }
.recorder__label { color: var(--on-immersive-muted-color); font-size: 18rpx; }
.recorder__name { margin-top: 4rpx; font-size: 25rpx; font-weight: 800; }
.recorder__link { color: var(--immersive-accent-color); font-size: 21rpx; }
.can-hero__actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}
.review-box { margin-top: 22rpx; padding-top: 22rpx; border-top: 1rpx solid var(--border-color); }
.review-actions { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 14rpx; }
.section-intro {
  margin-bottom: 20rpx;
  color: var(--muted-text-color);
  font-size: 23rpx;
  line-height: 1.6;
}
.post-row { padding: 20rpx 0; border-bottom: 1rpx solid var(--border-color); }
.post-row__author { color: var(--accent-color); font-size: 22rpx; font-weight: 900; }
.post-row__text { margin-top: 8rpx; color: var(--text-color); font-size: 27rpx; line-height: 1.55; }
.post-row__time { margin-top: 8rpx; color: var(--muted-text-color); font-size: 20rpx; }
</style>
