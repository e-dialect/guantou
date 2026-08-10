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
        <view
          v-if="can.recorder"
          class="recorder"
          @tap="toRecorder"
        >
          <image
            class="recorder-avatar"
            :src="can.recorder.avatar"
            mode="aspectFill"
          />
          <text>{{ can.recorder.nickname || can.recorder.username }}</text>
          <text class="recorder-link">
            作者主页 ›
          </text>
        </view>
        <button
          class="primary-button"
          @tap="playAudio(can.audio_url)"
        >
          播放乡音
        </button>
        <view class="social-actions">
          <button
            class="social-button"
            :class="{ active: can.liked_by_me }"
            :disabled="likeBusy"
            @tap="toggleLike"
          >
            {{ can.liked_by_me ? '♥ 已点赞' : '♡ 点赞' }} {{ can.like_count || 0 }}
          </button>
          <button
            class="social-button"
            open-type="share"
            @tap="shareCurrent"
          >
            分享
          </button>
        </view>
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
        <view
          v-if="transitionActions.length"
          class="review-box"
        >
          <textarea
            v-model="transitionReason"
            class="review-reason"
            maxlength="300"
            placeholder="流转理由（驳回时建议填写）"
          />
          <view class="review-actions">
            <button
              v-for="item in transitionActions"
              :key="item.action"
              class="review-button"
              :class="{ danger: item.action === 'reject' }"
              :disabled="transitionBusy"
              @tap="runTransition(item.action)"
            >
              {{ transitionBusy === item.action ? '处理中…' : item.label }}
            </button>
          </view>
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
          @support="support"
          @unsupport="unsupport"
        />
      </SectionBlock>

      <SectionBlock title="补一张铭牌">
        <NameplateComposer
          ref="composer"
          :focus="nameplateInputFocused"
          :submitting="submittingNameplate"
          :packages="packages"
          :flavors="flavors"
          :dialects="dialects"
          @submit="submitNameplate"
        />
      </SectionBlock>

      <SectionBlock :title="`评论 · ${can.comment_count || comments.length}`">
        <view class="comment-composer">
          <textarea
            v-model="commentText"
            class="comment-input"
            maxlength="500"
            placeholder="说说你听到的内容（1–500 字）"
          />
          <button
            class="comment-submit"
            :disabled="commentSubmitting"
            @tap="submitComment"
          >
            {{ commentSubmitting ? '发送中…' : '发表评论' }}
          </button>
        </view>
        <view
          v-if="!comments.length"
          class="comment-empty"
        >
          还没有评论，欢迎留下第一条真实反馈。
        </view>
        <view
          v-for="comment in comments"
          :key="comment.id"
          class="comment-row"
        >
          <image
            class="comment-avatar"
            :src="comment.author.avatar"
            mode="aspectFill"
          />
          <view class="comment-body">
            <view class="comment-head">
              <text class="comment-author">
                {{ comment.author.nickname || comment.author.username }}
              </text>
              <button
                v-if="canDeleteComment(comment)"
                class="comment-delete"
                @tap="removeComment(comment.id)"
              >
                删除
              </button>
              <button
                class="comment-like"
                :class="{ active: comment.liked_by_me }"
                @tap="toggleCommentLike(comment)"
              >
                {{ comment.liked_by_me ? '♥' : '♡' }} {{ comment.like_count || 0 }}
              </button>
            </view>
            <view class="comment-content">
              {{ comment.content }}
            </view>
            <view class="comment-time">
              {{ formatTime(comment.created_at) }}
            </view>
          </view>
        </view>
        <button
          v-if="Number(can.comment_count || 0) > comments.length"
          class="all-comments"
          @tap="toAllComments"
        >
          查看全部 {{ can.comment_count }} 条评论
        </button>
      </SectionBlock>
    </template>
  </PageShell>
</template>

<script>
import NameplateCard from '@/components/NameplateCard.vue';
import NameplateComposer from '@/components/NameplateComposer.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import {
  createNameplate,
  getCan,
  listAllDialects,
  listAllFlavors,
  listAllPackages,
  supportNameplate,
  transitionCan,
  unsupportNameplate,
} from '@/services/guantou';
import {
  createCanComment,
  deleteCanComment,
  likeCan,
  likeCanComment,
  listCanComments,
  unlikeCan,
  unlikeCanComment,
} from '@/services/canSocial';
import { requireAuth } from '@/services/authGuard';
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
  submit: '提交校验',
  verify: '审核通过',
  reject: '驳回',
  dispute: '提出争议',
  restore: '恢复待校验',
};

export function availableCanTransitions(can, user) {
  if (!can || !user || !user.id) return [];
  const isOwner = Number(can.recorder?.id) === Number(user.id);
  const actions = [];
  if (isOwner && can.status === 'pending') actions.push('submit');
  if (isOwner && can.status === 'tentative') actions.push('dispute');
  if ((isOwner || user.is_staff) && can.status === 'rejected') actions.push('restore');
  if (user.is_staff && ['tentative', 'disputed'].includes(can.status)) {
    actions.push('verify');
  }
  if (user.is_staff && ['pending', 'tentative', 'disputed'].includes(can.status)) {
    actions.push('reject');
  }
  return actions.map((action) => ({ action, label: transitionLabels[action] }));
}

function currentSessionUser() {
  const app = typeof getApp === 'function' ? getApp() : null;
  const storedId = typeof uni !== 'undefined' && uni.getStorageSync
    ? uni.getStorageSync('id')
    : null;
  return {
    id: app?.globalData?.userInfo?.id || storedId || null,
    is_staff: Boolean(app?.globalData?.userInfo?.is_staff),
  };
}

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
      comments: [],
      currentUser: currentSessionUser(),
      dialects: [],
      flavors: [],
      packages: [],
      commentSubmitting: false,
      commentText: '',
      likeBusy: false,
      nameplateInputFocused: false,
      submittingNameplate: false,
      transitionBusy: '',
      transitionReason: '',
    };
  },
  computed: {
    primaryText() {
      return this.can.primary_nameplate ? this.can.primary_nameplate.display_text : '无标罐头';
    },
    dialectText() {
      const primary = this.can.nameplates.find((plate) => plate.is_primary);
      if (primary?.dialect) {
        return primary.dialect.qualified_code;
      }
      return this.can.submitted_dialect?.qualified_code || '未标方言点';
    },
    transitionActions() {
      return availableCanTransitions(this.can, this.currentUser);
    },
  },
  async onLoad(options) {
    this.id = options.id;
    await Promise.all([
      this.refresh(),
      this.loadComments(),
      this.loadClaimOptions(),
    ]);
  },
  onShow() {
    this.currentUser = currentSessionUser();
  },
  onShareAppMessage() {
    return canSharePayload(this.can || { id: this.id });
  },
  methods: {
    playAudio,
    statusText(status) {
      return statusLabels[status] || status;
    },
    async refresh() {
      this.can = await getCan(this.id);
      this.comments = this.can.recent_comments || [];
    },
    async loadClaimOptions() {
      try {
        [this.packages, this.flavors, this.dialects] = await Promise.all([
          listAllPackages(),
          listAllFlavors(),
          listAllDialects(),
        ]);
      } catch (error) {
        this.packages = [];
        this.flavors = [];
        this.dialects = [];
      }
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
        uni.showToast({
          title: error.message || '状态更新失败',
          icon: 'none',
        });
      } finally {
        this.transitionBusy = '';
      }
    },
    async loadComments() {
      const response = await listCanComments(this.id, { page_size: 3 });
      this.comments = response.results || response || [];
    },
    async toggleLike() {
      if (!requireAuth('like', { page: 'can_detail', canId: this.id })) return;
      if (this.likeBusy) return;
      this.likeBusy = true;
      try {
        const response = this.can.liked_by_me
          ? await unlikeCan(this.id)
          : await likeCan(this.id);
        this.can.liked_by_me = response.liked;
        this.can.like_count = response.like_count;
      } finally {
        this.likeBusy = false;
      }
    },
    async submitComment() {
      if (!requireAuth('comment', { page: 'can_detail', canId: this.id })) return;
      const content = String(this.commentText || '').trim();
      if (!content) {
        uni.showToast({ title: '评论不能为空', icon: 'none' });
        return;
      }
      this.commentSubmitting = true;
      try {
        const comment = await createCanComment(this.id, content);
        this.comments.unshift(comment);
        this.comments = this.comments.slice(0, 3);
        this.commentText = '';
        this.can.comment_count = Number(this.can.comment_count || 0) + 1;
      } finally {
        this.commentSubmitting = false;
      }
    },
    async removeComment(commentId) {
      await deleteCanComment(commentId);
      this.comments = this.comments.filter((comment) => comment.id !== commentId);
      this.can.comment_count = Math.max(0, Number(this.can.comment_count || 0) - 1);
    },
    canDeleteComment(comment) {
      const user = getApp().globalData.userInfo || {};
      return Number(comment.author.id) === Number(uni.getStorageSync('id')) || user.is_admin;
    },
    async toggleCommentLike(comment) {
      if (!requireAuth('comment_like', { page: 'can_detail', canId: this.id })) return;
      const response = comment.liked_by_me
        ? await unlikeCanComment(comment.id)
        : await likeCanComment(comment.id);
      this.comments = this.comments.map((item) => (item.id === comment.id
        ? { ...item, liked_by_me: response.liked, like_count: response.like_count }
        : item));
    },
    toAllComments() {
      uni.navigateTo({ url: `/pages/cans/comments?id=${this.id}` });
    },
    formatTime(value) {
      return String(value || '').replace('T', ' ').slice(0, 16);
    },
    toRecorder() {
      if (this.can.recorder?.id) toUserPage(this.can.recorder.id);
    },
    async shareCurrent() {
      // #ifdef H5
      await shareCanOnWeb(this.can);
      // #endif
    },
    async support(id) {
      if (!requireAuth('nameplate_support', { page: 'can_detail', canId: this.id, nameplateId: id })) return;
      await supportNameplate(id);
      await this.refresh();
    },
    async unsupport(id) {
      if (!requireAuth('nameplate_support', { page: 'can_detail', canId: this.id, nameplateId: id })) return;
      await unsupportNameplate(id);
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

.recorder {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 20rpx;
  color: #56645b;
  font-size: 25rpx;
}

.review-box {
  margin-top: 22rpx;
  padding-top: 22rpx;
  border-top: 1px solid #e1e6df;
}

.review-reason {
  width: 100%;
  min-height: 110rpx;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  background: #ffffff;
  padding: 18rpx;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 14rpx;
}

.review-button {
  margin: 0;
  background: #1f5c43;
  color: #ffffff;
  font-size: 26rpx;
}

.review-button.danger {
  background: #9f3e32;
}

.recorder-avatar,
.comment-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #e5eae2;
}

.recorder-link {
  margin-left: auto;
  color: #1f5c43;
}

.primary-button {
  margin-top: 24rpx;
  background: #1f5c43;
  color: #ffffff;
  border-radius: 12rpx;
}

.social-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 14rpx;
}

.social-button {
  margin: 0;
  border-radius: 12rpx;
  background: #f0f3ed;
  color: #536259;
  font-size: 25rpx;
}

.social-button.active {
  background: #f7e9e5;
  color: #983f32;
}

.social-button::after {
  border: 0;
}

.comment-composer {
  padding: 18rpx;
  border: 1px solid #dfe5db;
  border-radius: 14rpx;
  background: #fafbf8;
}

.comment-input {
  width: 100%;
  min-height: 126rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.comment-submit {
  width: 180rpx;
  margin: 14rpx 0 0 auto;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 24rpx;
  line-height: 62rpx;
}

.comment-submit::after,
.comment-delete::after {
  border: 0;
}

.comment-empty {
  padding: 28rpx 0 10rpx;
  color: #79857d;
  font-size: 25rpx;
  text-align: center;
}

.comment-row {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 0;
  border-bottom: 1px solid #edf0eb;
}

.comment-body {
  min-width: 0;
  flex: 1;
}

.comment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-author {
  font-size: 25rpx;
  font-weight: 800;
}

.comment-delete {
  margin: 0;
  padding: 0 10rpx;
  background: transparent;
  color: #9a4b3d;
  font-size: 22rpx;
  line-height: 42rpx;
}

.comment-like {
  margin: 0 0 0 10rpx;
  padding: 0 12rpx;
  background: transparent;
  color: #728078;
  font-size: 22rpx;
  line-height: 42rpx;
}

.comment-like.active {
  color: #9a3f31;
}

.comment-like::after,
.all-comments::after {
  border: 0;
}

.all-comments {
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: #edf4ea;
  color: #1f5c43;
  font-size: 25rpx;
}

.comment-content {
  margin-top: 8rpx;
  color: #34463b;
  font-size: 27rpx;
  line-height: 1.55;
  white-space: pre-wrap;
}

.comment-time {
  margin-top: 8rpx;
  color: #8a948d;
  font-size: 21rpx;
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
