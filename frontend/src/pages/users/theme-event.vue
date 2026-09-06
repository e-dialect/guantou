<template>
  <PageShell
    title="方言活动"
    :back-fallback="ROUTES.themeAcquire"
  >
    <ThemeJourneyIntro
      eyebrow="限定活动"
      :title="item ? item.name : '活动入口已失效'"
      :description="eventIntro"
      :status="eventStatus"
      :tone="eventTone"
    />
    <view
      v-if="!item"
      class="empty-wrap"
    >
      <EmptyState
        title="没有找到这项活动"
        description="活动链接可能已失效；你可以返回装扮获取页查看仍在进行的活动。"
        action-text="查看获取方式"
        @action="goThemeAcquire"
      />
    </view>
    <view
      v-else
      class="card"
      :class="{ ended: ended }"
    >
      <view class="section-kicker">
        获取条件
      </view>
      <view class="muted">
        {{ eventRequirement }}
      </view>
      <view
        class="tag"
        :class="ended ? 'tag-ended' : 'tag-event'"
      >
        {{ ended ? '已绝版' : '活动限定' }}
      </view>
      <view
        v-if="ended && !owned"
        class="state-panel"
      >
        该装扮活动已结束，暂无法获取
      </view>
      <view
        v-else-if="owned"
        class="state-panel status"
      >
        已获得该装扮，可前往我的装扮使用
      </view>
      <view
        v-else
        class="state-panel"
      >
        完成同乡灯会任务后即可领取，活动结束后将绝版。
      </view>
      <BaseButton
        class="action"
        block
        :disabled="ended && !owned"
        :variant="ended && !owned ? 'ghost' : 'primary'"
        @click="onClaim"
      >
        {{ claimLabel }}
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
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import ThemeJourneyIntro from '@/components/ThemeJourneyIntro.vue';
import { notify, notifySuccess } from '@/services/feedback';
import { goThemeAcquire, ROUTES } from '@/services/navigation';
import { trackThemeApplyInvalid, trackThemeGet } from '@/services/themeAnalytics';
import {
  claimSkin,
  getDressItem,
  getThemeById,
  isOwned,
  THEME_ACCESS_FOOTER,
} from '@/services/themeCenter';

export default {
  components: {
    BaseButton, EmptyState, PageShell, ThemeJourneyIntro,
  },
  data() {
    return {
      ROUTES,
      kind: 'theme',
      itemId: '',
      owned: false,
      footerLines: THEME_ACCESS_FOOTER,
    };
  },
  computed: {
    item() {
      if (this.kind === 'dress') return getDressItem(this.itemId);
      return getThemeById(this.itemId);
    },
    ended() {
      return this.item?.eventStatus === 'ended';
    },
    claimLabel() {
      if (this.ended && !this.owned) return '已绝版';
      if (this.owned) return '已领取';
      return '完成并领取';
    },
    eventIntro() {
      if (!this.item) return '活动链接可能已失效，仍可返回获取页查看当前有效路径。';
      return this.item.blurb || this.item.description;
    },
    eventStatus() {
      if (!this.item) return '活动不可用';
      if (this.owned) return '已获得该装扮';
      return this.ended ? '活动已结束' : '活动进行中';
    },
    eventTone() {
      if (this.owned) return 'success';
      return this.ended || !this.item ? 'warning' : 'accent';
    },
    eventRequirement() {
      if (this.ended && !this.owned) return '活动已结束，不再接受新的领取任务。';
      if (this.owned) return '资格已经记录到账号，无需重复完成任务。';
      return '完成同乡灯会任务后即可领取；活动结束后不再开放新领取。';
    },
  },
  onLoad(options) {
    this.kind = options?.kind === 'dress' ? 'dress' : 'theme';
    this.itemId = options?.id || 'event-lantern';
    this.refresh();
  },
  onShow() {
    this.refresh();
  },
  methods: {
    goThemeAcquire,
    refresh() {
      this.owned = Boolean(this.item && isOwned(this.kind, this.item.id));
    },
    async onClaim() {
      if (!this.item) {
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (this.ended && !this.owned) {
        trackThemeApplyInvalid(this.kind, this.item, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (this.owned) {
        notifySuccess('已获得该装扮，可前往我的装扮使用');
        return;
      }
      const claimed = await Promise.resolve(claimSkin(this.kind, this.item.id));
      if (!claimed?.ok) {
        notify({
          title: claimed?.reason === 'ended'
            ? '该限定装扮活动已结束，无法获取'
            : '暂无权限使用该装扮',
        });
        return;
      }
      trackThemeGet(this.kind, this.item, 'event');
      this.refresh();
      notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
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

.empty-wrap {
  margin-top: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.card.ended {
  opacity: 0.84;
}

.section-kicker {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.1em;
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
  color: var(--accent-color);
}

.state-panel {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: 1.55;
}

.tag {
  display: inline-block;
  margin-top: var(--space-2);
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  line-height: 36rpx;
}

.tag-event {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.tag-ended {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
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
