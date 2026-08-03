<template>
  <view
    class="can-card"
    @tap="$emit('open', can.id)"
  >
    <view class="card-head">
      <text class="label">
        {{ primaryText }}
      </text>
      <text class="status">
        {{ statusText(can.status) }}
      </text>
    </view>
    <view class="concept">
      {{ can.concept_text || '未填写普通话概念' }}
    </view>
    <view class="meta">
      {{ locationText }} · {{ nameplateCount }} 张铭牌 · {{ can.views || 0 }} 次查看
    </view>
  </view>
</template>

<script>
const statusLabels = {
  unlabeled: '无铭牌',
  pending: '待校验',
  tentative: '社区暂定',
  verified: '正品认证',
  disputed: '有争议',
  rejected: '已驳回',
};

export default {
  name: 'CanCard',
  props: {
    can: {
      type: Object,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    primaryText() {
      return this.can.primary_nameplate
        ? this.can.primary_nameplate.text_content
        : '等待铭牌';
    },
    locationText() {
      if (this.can.dialect_detail) return this.can.dialect_detail.name;
      return [this.can.county, this.can.town].filter(Boolean).join('-') || '未标产地';
    },
    nameplateCount() {
      return Array.isArray(this.can.nameplates) ? this.can.nameplates.length : 0;
    },
  },
  methods: {
    statusText(status) {
      return statusLabels[status] || status || '未知';
    },
  },
};
</script>

<style scoped>
.can-card {
  background: #fff;
  border: 1px solid #e1e6dc;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.label {
  min-width: 0;
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.status {
  flex: 0 0 auto;
  font-size: 24rpx;
  color: #1f5c43;
  background: #e8f1eb;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.concept {
  margin-top: 14rpx;
  color: #33463b;
}

.meta {
  margin-top: 14rpx;
  color: #7a867d;
  font-size: 24rpx;
}
</style>
