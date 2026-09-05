<template>
  <PageShell
    title="装扮获取"
    :back-fallback="ROUTES.themeCenter"
  >
    <view class="lead">
      活动、会员与方言创作任务可在此领取装扮。H5 与小程序权限一致，会员状态两端同步。
    </view>

    <view class="block">
      <view class="block-title">
        会员
      </view>
      <view class="muted">
        开通会员即可解锁全部会员全局主题、会员局部装扮。
      </view>
      <view class="status-line">
        {{ member ? '会员权益已生效，两端同步。' : '当前未开通会员。' }}
      </view>
      <BaseButton
        class="row-action"
        size="small"
        :variant="member ? 'ghost' : 'primary'"
        @click="onGetMember"
      >
        {{ member ? '查看会员' : '去开通会员' }}
      </BaseButton>
    </view>

    <view class="block">
      <view class="block-title">
        进行中的活动
      </view>
      <view
        v-if="!eventOffers.length"
        class="muted"
      >
        暂无进行中的装扮活动。
      </view>
      <view
        v-for="item in eventOffers"
        :key="`${item.kind}-${item.id}`"
        class="offer pressable"
        @tap="openEvent(item)"
      >
        <view class="offer-name">
          {{ item.name }}
        </view>
        <view class="muted">
          {{ item.description }}
        </view>
        <view class="tag tag-event">
          活动限定
        </view>
        <BaseButton
          class="row-action"
          size="extra-small"
          @click="openEvent(item)"
        >
          去参与活动
        </BaseButton>
      </view>
    </view>

    <view class="block">
      <view class="block-title">
        方言创作任务
      </view>
      <view class="muted">
        完成方言创作任务即可解锁，录一段乡音积累创作成就。
      </view>
      <view class="task">
        录音贡献 {{ progress.recordings }}/10
      </view>
      <view class="task">
        方言达人徽章 {{ progress.badge ? '已获得' : '未获得' }}
      </view>
      <view class="task">
        方言话题挑战赛 {{ progress.challenge ? '已参与' : '未完成' }}
      </view>
      <view class="action-row">
        <BaseButton
          size="small"
          @click="onGetCreator"
        >
          去录乡音
        </BaseButton>
        <BaseButton
          size="small"
          variant="ghost"
          @click="goCircleList()"
        >
          去话题挑战赛
        </BaseButton>
      </view>
      <view class="muted">
        录音数从贡献履历自动核验；徽章与挑战资格由活动审核发放，不能在本页自行增加。
      </view>
      <view
        v-if="creatorReady"
        class="status-line ready"
      >
        已达成创作条件，可前往主题中心领取创作者装扮。
      </view>
    </view>

    <view class="block">
      <view class="block-title">
        方言主题福利
      </view>
      <view class="muted">
        每日录一段乡音可领取少量装扮碎片，碎片可以兑换限定方言装扮。当前碎片 {{ shards }}。
      </view>
      <BaseButton
        class="row-action"
        size="small"
        variant="ghost"
        @click="claimDailyShards"
      >
        领取今日碎片
      </BaseButton>
      <view class="muted">
        方言话题挑战赛获奖用户，发放专属限定头像框、主题皮肤。
      </view>
      <view class="muted">
        同乡、同方言圈子用户，可解锁部分地域专属装扮。
      </view>
      <BaseButton
        class="row-action"
        size="small"
        variant="ghost"
        @click="goCircleList()"
      >
        去同乡圈子
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
import { getMyContributionHistory } from '@/services/entryRecording';
import { notifySuccess } from '@/services/feedback';
import {
  goCircleList,
  goRecord,
  goThemeEvent,
  goThemeMember,
  ROUTES,
} from '@/services/navigation';
import { trackThemeGet } from '@/services/themeAnalytics';
import {
  ACCESS_EVENT,
  addShards,
  getCreatorProgress,
  getMemberStatus,
  getShards,
  listAcquireOffers,
  setCreatorProgress,
  THEME_ACCESS_FOOTER,
} from '@/services/themeCenter';

export default {
  components: { BaseButton, PageShell },
  data() {
    return {
      ROUTES,
      member: getMemberStatus(),
      progress: getCreatorProgress(),
      shards: getShards(),
      offers: listAcquireOffers(),
      footerLines: THEME_ACCESS_FOOTER,
    };
  },
  computed: {
    eventOffers() {
      const themes = this.offers.themes
        .filter((item) => item.access === ACCESS_EVENT && item.eventStatus === 'active')
        .map((item) => ({ ...item, kind: 'theme' }));
      const dresses = this.offers.dresses
        .filter((item) => item.access === ACCESS_EVENT && item.eventStatus === 'active')
        .map((item) => ({ ...item, kind: 'dress' }));
      return [...themes, ...dresses];
    },
    creatorReady() {
      const { recordings, badge, challenge } = this.progress;
      return recordings >= 10 && badge && challenge;
    },
  },
  async onShow() {
    this.refresh();
    await this.syncContributionCount();
  },
  methods: {
    goCircleList,
    onGetMember() {
      trackThemeGet('', null, 'member');
      goThemeMember();
    },
    onGetCreator() {
      trackThemeGet('', null, 'creator');
      goRecord();
    },
    refresh() {
      this.member = getMemberStatus();
      this.progress = getCreatorProgress();
      this.shards = getShards();
      this.offers = listAcquireOffers();
    },
    openEvent(item) {
      trackThemeGet(item.kind, item, 'event');
      goThemeEvent({ id: item.id, kind: item.kind });
    },
    async syncContributionCount() {
      try {
        const response = await getMyContributionHistory();
        const recordings = Math.max(0, Number(response?.summary?.recordings || 0));
        setCreatorProgress({ recordings });
        this.refresh();
      } catch (error) {
        // 游客或离线时只保留最后一次服务端核验过的快照。
      }
    },
    claimDailyShards() {
      const next = addShards(3);
      this.refresh();
      notifySuccess(`已领取碎片，当前 ${next}`);
    },
  },
};
</script>

<style scoped>
.lead,
.block {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.block-title,
.offer-name {
  font-weight: 700;
}

.muted,
.task,
.status-line,
.foot-note {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.status-line.ready {
  color: var(--accent-color);
}

.offer {
  margin-top: var(--space-3);
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

.row-action {
  margin-top: var(--space-2);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.foot-note {
  margin-top: var(--space-3);
  font-size: var(--font-size-xs);
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
