<template>
  <PageShell
    :title="group ? group.name : '局部装扮'"
    :back-fallback="ROUTES.themeCenter"
    @scroll="onShellScroll"
  >
    <view
      v-if="!group"
      class="empty-wrap"
    >
      <ThemeStatusPane scene="dress_coming" />
    </view>
    <view v-else>
      <ThemeJourneyIntro
        eyebrow="局部装扮"
        :title="group.name"
        :description="group.hint"
        :status="journeyStatus"
        :tone="journeyTone"
      />

      <view
        v-if="hasUpcomingItems"
        class="availability-note"
      >
        <text class="availability-note__label">
          目录状态
        </text>
        <text class="availability-note__copy">
          部分素材仍在制作，已上线项可正常预览和应用。
        </text>
      </view>

      <view class="directory-head">
        <view>
          <view class="directory-kicker">
            可用目录
          </view>
          <view class="directory-title">
            选择一种外观
          </view>
        </view>
        <view class="directory-count">
          {{ items.length }} 项
        </view>
      </view>
      <view class="filter-row">
        <view
          v-for="item in sortOptions"
          :key="item.value"
          class="chip pressable"
          :class="{ active: dressSort === item.value }"
          @tap="dressSort = item.value"
        >
          {{ item.label }}
        </view>
      </view>

      <view
        v-if="!items.length"
        class="empty-wrap"
      >
        <ThemeStatusPane scene="dress_coming" />
      </view>

      <view
        v-for="item in items"
        :key="item.id"
        class="item-card pressable"
        :class="{ placeholder: !item.available, applied: item.id === appliedId }"
        @tap="openDetail(item)"
      >
        <view class="shot-wrap">
          <image
            v-if="dressCoverSrc(item)"
            class="thumb thumb-photo"
            :class="{ blurred: !item.available }"
            :src="dressCoverSrc(item)"
            mode="aspectFill"
            lazy-load
            @error="onPreviewImgError(item.id)"
          />
          <view
            v-else
            class="thumb"
            :class="[`thumb-${item.preview}`, { blurred: !item.available }]"
          >
            <view class="thumb-bar" />
            <view class="thumb-card" />
          </view>
          <view
            v-if="!item.available"
            class="soon-overlay"
          >
            敬请期待
          </view>
        </view>
        <view class="item-body">
          <view class="item-head">
            <view class="item-name">
              {{ item.name }}
            </view>
            <view
              class="tag"
              :class="tagClass(item)"
            >
              {{ item.tag }}
            </view>
          </view>
          <view class="muted">
            {{ item.description }}
          </view>
          <view
            v-if="dressAccess(item).hint"
            class="warn"
          >
            {{ dressAccess(item).hint }}
          </view>
          <view
            v-if="item.id === appliedId"
            class="applied-mark"
          >
            已应用{{ overlay ? ' · 暂时失效' : '' }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="icon-btn"
              :class="{
                on: isItemFav(item.id),
              }"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`${isItemFav(item.id) ? '取消收藏' : '收藏'}装扮：${item.name}`"
              :disabled="!item.available"
              @click="onToggleFavorite(item)"
            >
              {{ isItemFav(item.id) ? '★' : '☆' }}
            </BaseButton>
            <BaseButton
              class="icon-btn"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`分享装扮：${item.name}`"
              :disabled="!item.available"
              @click="onShare(item)"
            >
              ↗
            </BaseButton>
            <BaseButton
              class="item-action"
              size="extra-small"
              :variant="itemActionVariant(item)"
              :disabled="itemActionDisabled(item)"
              @click="onApply(item)"
            >
              {{ applyLabel(item) }}
            </BaseButton>
            <BaseButton
              v-if="item.id === appliedId"
              class="item-action"
              size="extra-small"
              variant="ghost"
              @click="onClear"
            >
              恢复跟随主题
            </BaseButton>
          </view>
        </view>
      </view>
      <view
        v-for="line in accessFooter"
        :key="line"
        class="foot-note"
      >
        {{ line }}
      </view>
      <view
        v-for="line in socialFooter"
        :key="`social-${line}`"
        class="foot-note"
      >
        {{ line }}
      </view>
      <view
        v-for="line in previewFooter"
        :key="`preview-${line}`"
        class="foot-note"
      >
        {{ line }}
      </view>
    </view>

    <view
      v-if="detailItem"
      class="sheet-mask"
      @tap="closeDetail"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet"
        @tap.stop
      >
        <view class="shot-wrap">
          <view
            class="sheet-tools"
            @tap.stop
          >
            <BaseButton
              class="icon-btn"
              :class="{
                on: isItemFav(detailItem.id),
              }"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`${isItemFav(detailItem.id) ? '取消收藏' : '收藏'}装扮：${detailItem.name}`"
              :disabled="!detailItem.available"
              @click="onToggleFavorite(detailItem)"
            >
              {{ isItemFav(detailItem.id) ? '★' : '☆' }}
            </BaseButton>
            <BaseButton
              class="icon-btn"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`分享装扮：${detailItem.name}`"
              :disabled="!detailItem.available"
              @click="onShare(detailItem)"
            >
              ↗
            </BaseButton>
          </view>
          <view
            class="thumb thumb-lg pressable"
            :class="[`thumb-${detailItem.preview}`, { blurred: !detailItem.available }]"
            @tap="openZoom"
          >
            <image
              v-if="dressDetailSrc(detailItem)"
              class="thumb-photo"
              :src="dressDetailSrc(detailItem)"
              mode="aspectFill"
              lazy-load
              @error="onPreviewImgError(`detail:${detailItem.id}`)"
            />
            <template v-else>
              <view class="thumb-bar" />
              <view class="thumb-card" />
            </template>
          </view>
          <view
            v-if="!detailItem.available"
            class="soon-overlay"
          >
            敬请期待
          </view>
          <view
            v-if="isMiniProgram"
            class="preview-corner"
          >
            ⚠️小程序部分原生组件为系统默认样式
          </view>
        </view>
        <view class="item-name">
          {{ detailItem.name }}
        </view>
        <view class="muted">
          {{ group.name }}
        </view>
        <view class="muted">
          {{ detailItem.description }}
        </view>
        <view class="muted">
          预览仅为模拟效果，不会修改你的界面
        </view>
        <view
          class="tag"
          :class="tagClass(detailItem)"
        >
          {{ detailItem.tag }}
        </view>
        <view
          class="social-stats pressable"
          @tap="onToggleLike(detailItem)"
        >
          {{ statsOf(detailItem).liked ? '♥' : '♡' }}
          热度 {{ statsOf(detailItem).likes }}
          · 收藏 {{ statsOf(detailItem).favorites }}
        </view>
        <view class="muted">
          喜欢仅代表喜爱，不等于拥有该装扮
        </view>
        <view
          v-if="dressAccess(detailItem).hint"
          class="hint-row"
        >
          {{ dressAccess(detailItem).hint }}
        </view>
        <view class="hint-row">
          H5网页版：完整生效
        </view>
        <view class="hint-row warn">
          {{ mpHintFor(detailItem) }}
        </view>
        <view class="muted">
          {{ group.feature }}
        </view>
        <view
          v-if="!detailItem.available"
          class="warn"
        >
          装扮素材即将上线
        </view>
        <view class="sheet-actions">
          <BaseButton
            variant="ghost"
            size="small"
            @click="closeDetail"
          >
            取消
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!detailItem.available"
            @click="onToggleFavorite(detailItem)"
          >
            {{ isItemFav(detailItem.id) ? '取消收藏' : '加入收藏' }}
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!detailItem.available"
            @click="onShare(detailItem)"
          >
            分享
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!canLivePreviewItem(detailItem)"
            @click="openLivePreview(detailItem)"
          >
            实时预览
          </BaseButton>
          <BaseButton
            size="small"
            :variant="itemActionVariant(detailItem)"
            :disabled="itemActionDisabled(detailItem)"
            @click="onApply(detailItem)"
          >
            {{ applyLabel(detailItem) }}
          </BaseButton>
          <BaseButton
            v-if="detailItem.id === appliedId"
            size="small"
            variant="ghost"
            @click="onClear"
          >
            恢复跟随主题
          </BaseButton>
        </view>
      </view>
    </view>

    <ThemeLivePreview
      v-if="previewOpen"
      :open="true"
      title="实时预览"
      :model="livePreviewModel"
      @cancel="closePreview"
      @apply="onConfirmPreview"
    />

    <view
      v-if="zoomOpen && detailItem"
      class="sheet-mask zoom-mask"
      @tap="closeZoom"
    >
      <view class="sheet-mask-dim" />
      <view
        class="zoom-sheet"
        @tap.stop
      >
        <BaseButton
          class="preview-close"
          size="small"
          variant="ghost"
          aria-label="关闭装扮大图"
          @click="closeZoom"
        >
          关闭
        </BaseButton>
        <view class="muted">
          {{ zoomHint }}
        </view>
        <movable-area class="zoom-area">
          <movable-view
            class="zoom-view"
            direction="all"
            :scale="true"
            scale-min="1"
            scale-max="3"
          >
            <image
              v-if="dressDetailSrc(detailItem)"
              class="thumb thumb-xl thumb-photo"
              :src="dressDetailSrc(detailItem)"
              mode="aspectFit"
            />
            <view
              v-else
              class="thumb thumb-xl"
              :class="`thumb-${detailItem.preview}`"
            >
              <view class="thumb-bar" />
              <view class="thumb-card" />
            </view>
          </movable-view>
        </movable-area>
      </view>
    </view>

    <ThemeShareSheet
      :target="shareTarget"
      :is-mini-program="isMiniProgram"
      @close="shareTarget = null"
    />
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import confirmDialog from '@/components/ConfirmDialog';
import PageShell from '@/components/PageShell.vue';
import ThemeJourneyIntro from '@/components/ThemeJourneyIntro.vue';
import ThemeLivePreview from '@/components/ThemeLivePreview.vue';
import ThemeShareSheet from '@/components/ThemeShareSheet.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';
import { notify, notifySuccess } from '@/services/feedback';
import {
  goBack,
  goThemeAcquire,
  goThemeEvent,
  goThemeMember,
  ROUTES,
} from '@/services/navigation';
import { isWechatMiniProgram } from '@/services/platform';
import {
  trackThemeApply,
  trackThemeApplyInvalid,
  trackThemeCollect,
  trackThemeFault,
  trackThemeGet,
  trackThemeItemDetail,
  trackThemeListScroll,
  trackThemePreview,
  trackThemeUnsupportedEnv,
} from '@/services/themeAnalytics';
import {
  accessActionLabel,
  accessTagClass,
  canLivePreview,
  claimSkin,
  clearLocalDress,
  composePreviewOutfit,
  describeAccess,
  getActiveTheme,
  getDressGroup,
  getLocalDressMap,
  getOverlayLocalDress,
  isFavorited,
  isRemotePreviewSrc,
  listDressItems,
  persistLocalDress,
  previewCoverOf,
  previewDetailOf,
  socialStats,
  THEME_ACCESS_FOOTER,
  THEME_PREVIEW_FOOTER,
  THEME_PREVIEW_ZOOM_HINT,
  THEME_SOCIAL_FOOTER,
  THEME_SORTS,
  toggleFavorite,
  toggleLike,
} from '@/services/themeCenter';
import {
  abortThemePreview,
  beginThemeApply,
  beginThemePreview,
  isThemeSdkSupported,
  THEME_FAULT_TOAST,
} from '@/services/themeFault';
import { cleanThemeShareQuery, themeSharePayload } from '@/utils/themeShare';

export default {
  components: {
    BaseButton, PageShell, ThemeJourneyIntro, ThemeLivePreview, ThemeShareSheet, ThemeStatusPane,
  },
  data() {
    return {
      ROUTES,
      groupId: '',
      appliedId: '',
      overlay: getOverlayLocalDress(),
      isMiniProgram: isWechatMiniProgram(),
      detailItem: null,
      shareTarget: null,
      previewOpen: false,
      zoomOpen: false,
      coverFailed: {},
      previewItem: null,
      previewModel: null,
      dressSort: 'newest',
      socialTick: 0,
      sortOptions: THEME_SORTS,
      accessFooter: THEME_ACCESS_FOOTER,
      socialFooter: THEME_SOCIAL_FOOTER,
      previewFooter: THEME_PREVIEW_FOOTER,
      zoomHint: THEME_PREVIEW_ZOOM_HINT,
      scrollTimer: 0,
      sdkSupported: true,
    };
  },
  computed: {
    journeyStatus() {
      if (this.blocked) return '当前小程序环境暂不支持该类装扮';
      if (this.overlay) return '全局主题覆盖已开启，局部选择会保留但暂不显示';
      return '只替换当前部件，其它已选装扮保持不变';
    },
    journeyTone() {
      return this.blocked || this.overlay ? 'warning' : 'accent';
    },
    group() {
      return getDressGroup(this.groupId);
    },
    items() {
      return listDressItems(this.groupId, this.dressSort);
    },
    hasUpcomingItems() {
      return this.items.some((item) => !item.available);
    },
    blocked() {
      return Boolean(this.group?.mpBlocked && this.isMiniProgram);
    },
    livePreviewModel() {
      return this.previewModel || composePreviewOutfit({
        isMiniProgram: this.isMiniProgram,
      });
    },
  },
  onLoad(options) {
    this.sdkSupported = isThemeSdkSupported();
    this.groupId = cleanThemeShareQuery(options?.group) || options?.group || '';
    if (!getDressGroup(this.groupId)) {
      goBack(ROUTES.themeCenter);
      return;
    }
    this.refresh();
    if (options?.id) {
      const shareId = cleanThemeShareQuery(options.id);
      const match = shareId && this.items.find((item) => item.id === shareId);
      if (match) this.openDetail(match);
    }
  },
  onShow() {
    this.refresh();
  },
  onShareAppMessage() {
    if (this.shareTarget?.item?.available) {
      return themeSharePayload(this.shareTarget.kind, this.shareTarget.item);
    }
    const live = this.items.find((item) => item.available);
    return live ? themeSharePayload('dress', live) : { title: '', path: '' };
  },
  methods: {
    refresh() {
      this.overlay = getOverlayLocalDress();
      this.appliedId = getLocalDressMap()[this.groupId] || '';
      this.socialTick += 1;
    },
    onShellScroll(event) {
      const top = event?.scrollTop || 0;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        trackThemeListScroll({
          itemIds: this.items.map((item) => item.id),
          scrollTop: top,
          query: { sort: this.dressSort },
        });
      }, 400);
    },
    statsOf(item) {
      return socialStats('dress', item, this.socialTick);
    },
    isItemFav(id) {
      return this.socialTick >= 0 && isFavorited('dress', id);
    },
    async onToggleFavorite(item) {
      if (!beginThemeApply(`fav:dress:${item?.id}`).ok) return;
      const already = isFavorited('dress', item?.id);
      if (!item?.available && !already) {
        notify({ title: '待上线装扮暂不支持收藏' });
        return;
      }
      const result = await Promise.resolve(toggleFavorite('dress', item));
      if (!result?.ok) {
        if (result?.reason === 'upcoming') {
          notify({ title: '待上线装扮暂不支持收藏' });
        } else if (result?.reason === 'rate') {
          notify({ title: THEME_FAULT_TOAST.rate });
        }
        return;
      }
      this.refresh();
      trackThemeCollect('dress', item, result.favorited);
      if (result.queued) {
        notify({ title: THEME_FAULT_TOAST.socialSyncFail });
        return;
      }
      notifySuccess(result.favorited ? '已收藏该装扮' : '已取消收藏');
    },
    onToggleLike(item) {
      if (!item?.available) return;
      toggleLike('dress', item);
      this.refresh();
    },
    onShare(item) {
      if (!beginThemeApply(`share:dress:${item?.id}`).ok) return;
      if (!item?.available) {
        notify({ title: '待上线装扮暂不支持分享' });
        return;
      }
      this.shareTarget = { kind: 'dress', item };
    },
    applyLabel(item) {
      return accessActionLabel(this.dressAccess(item), {
        applied: item.id === this.appliedId,
        kind: 'dress',
      });
    },
    dressAccess(item) {
      return describeAccess(item, 'dress', {
        group: this.group,
        isMiniProgram: this.isMiniProgram,
      });
    },
    tagClass(item) {
      return accessTagClass(item);
    },
    itemActionDisabled(item) {
      const info = this.dressAccess(item);
      if (!this.sdkSupported) return true;
      if (item.id === this.appliedId) return true;
      return info.disabled
        || info.action === 'soon'
        || info.action === 'ended'
        || info.action === 'removed'
        || info.action === 'broken'
        || info.action === 'mp-block';
    },
    itemActionVariant(item) {
      if (this.itemActionDisabled(item)) return 'ghost';
      return 'primary';
    },
    mpHintFor(item) {
      const info = this.dressAccess(item);
      if (this.blocked && info.owned) return '拥有权限，但小程序环境暂不支持该装扮';
      if (this.blocked) return '微信小程序：当前环境不支持该装扮，仅H5可用';
      return '微信小程序：原生导航栏、底部Tab栏受微信限制，该装扮在H5完整生效';
    },
    openDetail(item) {
      this.detailItem = item;
      this.zoomOpen = false;
      trackThemeItemDetail('dress', item, this.group);
      trackThemePreview('dress', item, 'detail');
    },
    closeDetail() {
      this.zoomOpen = false;
      this.detailItem = null;
    },
    dressCoverSrc(item) {
      const src = previewCoverOf(item);
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[item.id]) return '';
      return src;
    },
    dressDetailSrc(item) {
      const src = previewDetailOf(item);
      const key = `detail:${item?.id}`;
      if (!item?.id || !isRemotePreviewSrc(src) || this.coverFailed[key]) return '';
      return src;
    },
    onPreviewImgError(key) {
      if (this.coverFailed[key]) return;
      const firstFail = !Object.keys(this.coverFailed).length;
      this.coverFailed = { ...this.coverFailed, [key]: true };
      if (firstFail) notify({ title: THEME_FAULT_TOAST.resource });
    },
    openZoom() {
      if (!this.detailItem) return;
      if (!beginThemeApply('preview-zoom').ok) return;
      this.zoomOpen = true;
    },
    closeZoom() {
      this.zoomOpen = false;
    },
    canLivePreviewItem(item) {
      return canLivePreview(item);
    },
    openLivePreview(item) {
      if (!canLivePreview(item)) {
        notify({
          title: item?.eventStatus === 'ended'
            ? '该装扮已绝版，无法再次使用'
            : '装扮素材即将上线',
        });
        return;
      }
      if (this.previewOpen) return;
      if (!beginThemeApply('preview-open').ok) return;
      this.previewItem = item;
      beginThemePreview();
      this.previewModel = composePreviewOutfit({
        themeId: getActiveTheme().id,
        extraDress: item,
        isMiniProgram: this.isMiniProgram,
      });
      this.previewOpen = true;
      trackThemePreview('dress', item, 'live');
    },
    closePreview() {
      abortThemePreview();
      this.previewOpen = false;
      this.previewItem = null;
      this.previewModel = null;
    },
    async onConfirmPreview() {
      if (!this.previewItem) {
        this.closePreview();
        return;
      }
      await this.onApply(this.previewItem);
      this.closePreview();
      this.closeDetail();
    },
    async openMemberGate(item) {
      const go = await confirmDialog({
        title: '开通会员',
        content: '该装扮为会员专属，开通会员即可解锁全部会员主题与装扮。开通后可解锁全部会员全局主题、会员局部装扮。',
        confirmText: '开通会员',
        cancelText: '取消',
      });
      if (go) {
        trackThemeGet('dress', item, 'member');
        goThemeMember();
      }
    },
    async onApply(item) {
      const info = this.dressAccess(item);
      if (info.action === 'removed') {
        notify({ title: '装扮已下架' });
        return;
      }
      if (info.action === 'broken') {
        notify({ title: THEME_FAULT_TOAST.resource });
        return;
      }
      if (!this.sdkSupported) {
        notify({ title: THEME_FAULT_TOAST.sdk });
        return;
      }
      if (info.action === 'soon') {
        trackThemeApplyInvalid('dress', item, '已下架');
        notify({ title: '装扮素材即将上线' });
        return;
      }
      if (info.action === 'ended') {
        trackThemeApplyInvalid('dress', item, '已绝版');
        notify({ title: '该限定装扮活动已结束，无法获取' });
        return;
      }
      if (info.action === 'member') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'member',
        });
        await this.openMemberGate(item);
        return;
      }
      if (info.action === 'event') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'event',
        });
        trackThemeGet('dress', item, 'event');
        goThemeEvent({ id: item.id, kind: 'dress' });
        return;
      }
      if (info.action === 'creator-lock') {
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'no_permission',
          permission: 'creator',
        });
        trackThemeGet('dress', item, 'creator');
        notify({ title: '暂未满足解锁条件，请完成方言创作任务' });
        goThemeAcquire({ focus: 'creator' });
        return;
      }
      if (info.action === 'claim') {
        const claimed = await Promise.resolve(claimSkin('dress', item.id));
        if (!claimed?.ok) {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        trackThemeGet('dress', item, item.access);
        this.refresh();
        notifySuccess('恭喜，已获得该装扮，可前往我的装扮使用');
        return;
      }
      if (this.blocked) {
        trackThemeUnsupportedEnv('dress', item);
        trackThemeApply({
          kind: 'dress',
          item,
          result: 'unsupported_env',
        });
        notify({
          title: info.owned
            ? '拥有权限，但小程序环境暂不支持该装扮'
            : '当前小程序环境暂不支持该装扮',
        });
        return;
      }
      if (item.id === this.appliedId) return;
      if (!beginThemeApply(`dress:${item.id}`).ok) return;
      const result = await persistLocalDress(this.groupId, item.id);
      if (!result.ok) {
        if (result.reason === 'quota') {
          notify({ title: THEME_FAULT_TOAST.quota });
          return;
        }
        if (result.reason === 'terminal') {
          notify({ title: '当前环境暂不支持该装扮' });
          return;
        }
        if (result.reason === 'privilege') {
          notify({ title: '暂无权限使用该装扮' });
          return;
        }
        notify({ title: '装扮素材即将上线' });
        return;
      }
      if (result.reason === 'rate') {
        notify({ title: THEME_FAULT_TOAST.rate });
        trackThemeFault('rate');
        this.refresh();
        this.closeDetail();
        return;
      }
      if (result.persisted === false) {
        notify({ title: THEME_FAULT_TOAST.quota });
      }
      trackThemeApply({ kind: 'dress', item, result: 'success' });
      this.refresh();
      this.closeDetail();
      notifySuccess('装扮已生效');
    },
    onClear() {
      const result = clearLocalDress(this.groupId);
      if (result.reason === 'quota' || result.persisted === false) {
        notify({ title: THEME_FAULT_TOAST.quota });
      }
      this.refresh();
      this.closeDetail();
      notifySuccess('已恢复跟随全局主题');
    },
  },
};
</script>

<style scoped>
.item-card {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.item-card {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.item-card.placeholder {
  background: var(--surface-subtle-color);
}

.item-card.applied {
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px var(--accent-subtle-color);
}

.item-body {
  min-width: 0;
  flex: 1;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.item-head .tag,
.item-head .item-name {
  margin-top: 0;
}

.theme-action-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.theme-action-wrap .item-action {
  margin-top: 0;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.directory-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.directory-kicker,
.availability-note__label {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.1em;
}

.directory-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.directory-count {
  flex: 0 0 auto;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.availability-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.availability-note__label {
  flex: 0 0 auto;
  letter-spacing: 0;
}

.availability-note__copy {
  min-width: 0;
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.chip {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-color);
  font-size: var(--font-size-xs);
}

.chip.active {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.icon-btn {
  flex-shrink: 0;
  margin: 0;
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.icon-btn.on {
  color: var(--warning-color);
}

.sheet-tools {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 2;
  display: flex;
  gap: var(--space-1);
}

.social-stats {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.item-name {
  margin-top: var(--space-2);
  font-weight: 700;
}

.muted,
.warn {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.muted {
  color: var(--muted-color);
}

.warn,
.applied-mark {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}

.tag {
  display: inline-block;
  margin-top: var(--space-2);
  flex-shrink: 0;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  line-height: 36rpx;
}

.tag-free {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.tag-soon {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.tag-member,
.tag-event,
.tag-creator {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.tag-ended {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.item-action,
.foot-note {
  margin-top: var(--space-2);
}

.foot-note {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.shot-wrap {
  position: relative;
  flex-shrink: 0;
}

.preview-corner {
  position: absolute;
  right: var(--space-1);
  bottom: var(--space-1);
  z-index: 2;
  max-width: 90%;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--warning-color);
  font-size: var(--font-size-xs);
  line-height: 36rpx;
}

.thumb {
  width: 144rpx;
  height: 144rpx;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  background: var(--page-color);
  box-sizing: border-box;
  overflow: hidden;
}

.thumb-lg {
  width: 100%;
  height: 240rpx;
}

.thumb-xl {
  width: 100%;
  height: 520rpx;
}

.thumb-photo {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.zoom-sheet {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: var(--space-4) var(--space-3);
  background: var(--page-color);
  box-sizing: border-box;
}

.zoom-area {
  width: 100%;
  height: 0;
  flex: 1;
  margin-top: var(--space-3);
}

.zoom-view {
  width: 100%;
  height: 100%;
}

.preview-close {
  align-self: flex-end;
  margin: 0;
}

.thumb.blurred {
  filter: blur(6px);
  opacity: 0.7;
}

.soon-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: calc(100% - var(--space-1));
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--muted-color);
  font-size: 18rpx;
  font-weight: 700;
  line-height: 34rpx;
  white-space: nowrap;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
}

.thumb-bar,
.thumb-card {
  border-radius: var(--radius-sm);
  background: var(--accent-color);
}

.thumb-bar {
  height: 18rpx;
}

.thumb-card {
  height: 36rpx;
  margin-top: var(--space-1);
  background: var(--surface-color);
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.thumb-navbar .thumb-bar,
.thumb-tabbar .thumb-bar {
  height: 28rpx;
}

.thumb-tabbar {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.thumb-actions .thumb-card {
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
}

.thumb-profile {
  background: var(--accent-subtle-color);
}

.thumb-avatar .thumb-card {
  width: 56rpx;
  height: 56rpx;
  margin: 20rpx auto 0;
  border-radius: var(--radius-pill);
  box-shadow: 0 0 0 4rpx var(--gilt-color);
}

.thumb-comment .thumb-card {
  width: 72%;
  height: 44rpx;
  border-radius: var(--radius-md);
}

.thumb-topic .thumb-bar {
  width: 40%;
}

.thumb-chrome .thumb-card {
  height: 28rpx;
  margin-top: var(--space-3);
}

.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  box-sizing: border-box;
}

.sheet-mask-dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--text-color);
  opacity: 0.46;
}

.sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 80vh;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-sizing: border-box;
  overflow: auto;
}

.hint-row {
  margin-top: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 1.55;
}

.hint-row.warn {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.sheet-actions .base-button {
  flex: 1;
}

.empty-wrap {
  margin-top: var(--space-3);
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
