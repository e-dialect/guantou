<template>
  <PageShell
    :title="circle ? circle.name : '方言圈'"
    :scroll="false"
    content-class="circle-detail-content"
    :action-text="circle ? (circle.is_member ? '退出' : '加入') : ''"
    @action="toggleMembership"
  >
    <view
      v-if="circle"
      class="circle-header"
    >
      <view class="description">
        {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
      </view>
      <view class="meta">
        {{ circle.member_count }} 位成员 · {{ circle.can_count }} 个公开罐头
      </view>
      <button
        class="record-button"
        @tap="recordHere"
      >
        录一罐 {{ circle.dialect.name }}
      </button>
    </view>
    <CanList
      v-if="circle"
      :fetcher="fetchCircleCans"
      empty-title="圈里还没有公开罐头"
      empty-description="录下第一段乡音，邀请同乡一起校验。"
      empty-action-text="录第一罐"
      social
      @open="toCan"
      @comment="toCan"
      @empty-action="recordHere"
    />
    <view
      v-else-if="error"
      class="state"
      @tap="loadCircle"
    >
      {{ error }}，点此重试
    </view>
    <view
      v-else
      class="state"
    >
      正在加载方言圈…
    </view>
  </PageShell>
</template>

<script>
import CanList from '@/components/CanList.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import {
  getCircle, joinCircle, leaveCircle, listCircleCans,
} from '@/services/guantou';

export default {
  components: { CanList, PageShell },
  data() {
    return { circle: null, circleId: null, error: '' };
  },
  onLoad(options) {
    this.circleId = Number(options.id);
    this.loadCircle();
  },
  methods: {
    async loadCircle() {
      this.error = '';
      try {
        this.circle = await getCircle(this.circleId);
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      }
    },
    fetchCircleCans(params) {
      return listCircleCans(this.circleId, params);
    },
    async toggleMembership() {
      if (!this.circle) return;
      if (!requireAuth('circle_join', { page: 'circle_detail', circleId: this.circle.id })) return;
      const result = this.circle.is_member
        ? await leaveCircle(this.circle.id)
        : await joinCircle(this.circle.id);
      this.circle = { ...this.circle, ...result };
    },
    recordHere() {
      if (!requireAuth('record_can', {
        page: 'circle_detail',
        circleId: this.circle.id,
        dialectId: this.circle.dialect.id,
      })) return;
      uni.navigateTo({ url: `/pages/cans/create?dialect=${this.circle.dialect.id}` });
    },
    toCan(id) {
      uni.navigateTo({ url: `/pages/cans/details?id=${id}` });
    },
  },
};
</script>

<style scoped>
:deep(.circle-detail-content) {
  display: flex;
  height: calc(100vh - 96rpx);
  min-height: 0;
  flex-direction: column;
  padding: 20rpx 28rpx 40rpx;
}
.circle-header {
  flex: 0 0 auto;
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #eef5ed;
}
.description { color: #32463b; line-height: 1.55; }
.meta { margin-top: 10rpx; color: #718078; font-size: 24rpx; }
.record-button {
  margin: 20rpx 0 0;
  border-radius: 999rpx;
  background: #1f5c43;
  color: #fff;
  font-size: 26rpx;
}
.record-button::after { border: 0; }
.state { padding: 80rpx 20rpx; color: #6b786f; text-align: center; }
</style>
