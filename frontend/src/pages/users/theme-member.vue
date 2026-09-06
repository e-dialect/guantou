<template>
  <PageShell
    title="开通会员"
    :back-fallback="ROUTES.themeCenter"
  >
    <ThemeJourneyIntro
      eyebrow="会员权益"
      title="一处开通，装扮资格跟随账号"
      description="会员主题与局部装扮会在 H5 网页和微信小程序同步；实际可用范围以账号权益为准。"
      :status="member ? '当前会员权益已生效' : '当前未开通会员'"
      :tone="member ? 'success' : 'neutral'"
    />
    <view class="card">
      <view class="section-kicker">
        权益说明
      </view>
      <view class="title">
        乡声集盒会员
      </view>
      <view class="benefit-list">
        <view class="benefit-row">
          <text class="benefit-mark">
            装
          </text>
          <view>
            <view class="benefit-title">
              会员装扮
            </view>
            <view class="muted">
              解锁全部会员全局主题、会员局部装扮。
            </view>
          </view>
        </view>
        <view class="benefit-row">
          <text class="benefit-mark">
            同
          </text>
          <view>
            <view class="benefit-title">
              账号同步
            </view>
            <view class="muted">
              切换设备或终端后，已获得的资格仍跟随同一账号。
            </view>
          </view>
        </view>
      </view>
      <view class="status-panel">
        <view class="status-label">
          当前状态
        </view>
        <view class="status">
          {{ member ? '会员权益已生效' : '普通账户' }}
        </view>
        <view class="muted">
          当前为演示占位，真实会员以账号权益为准。
        </view>
      </view>
      <BaseButton
        class="action"
        block
        :variant="member ? 'ghost' : 'primary'"
        @click="onToggle"
      >
        {{ member ? '会员已生效' : '开通会员' }}
      </BaseButton>
    </view>
    <view
      v-for="line in footerLines"
      :key="line"
      class="foot-note"
    >
      {{ line }}
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import PageShell from '@/components/PageShell.vue';
import ThemeJourneyIntro from '@/components/ThemeJourneyIntro.vue';
import { notifySuccess } from '@/services/feedback';
import { ROUTES } from '@/services/navigation';
import { trackThemeGet } from '@/services/themeAnalytics';
import {
  getMemberStatus,
  setMemberStatus,
  THEME_ACCESS_FOOTER,
} from '@/services/themeCenter';

export default {
  components: { BaseButton, PageShell, ThemeJourneyIntro },
  data() {
    return {
      ROUTES,
      member: getMemberStatus(),
      footerLines: THEME_ACCESS_FOOTER,
    };
  },
  onShow() {
    this.member = getMemberStatus();
  },
  methods: {
    onToggle() {
      if (this.member) {
        notifySuccess('会员权益已在两端同步');
        return;
      }
      trackThemeGet('', null, 'member');
      this.member = setMemberStatus(true);
      notifySuccess('会员已开通，装扮权益两端同步');
    },
  },
};
</script>

<style scoped>
.card {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.section-kicker,
.status-label {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.1em;
}

.benefit-list {
  margin-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.benefit-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.benefit-mark {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
}

.benefit-title {
  color: var(--text-color);
  font-weight: 700;
}

.benefit-row .muted {
  margin-top: var(--space-1);
}

.status-panel {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.muted,
.status,
.foot-note {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.status {
  margin-top: var(--space-1);
  color: var(--accent-color);
  font-weight: 800;
}

.action {
  margin-top: var(--space-3);
}

.foot-note {
  padding: 0 var(--space-1);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}
</style>
