<template>
  <AppShell
    title="我的账户"
    active="me"
  >
    <view class="page">
      <template v-if="loggedIn">
        <view
          v-if="loading"
          class="state-card"
        >
          正在读取你的乡音档案…
        </view>
        <view
          v-else-if="loadError"
          class="state-card"
        >
          <view>{{ loadError }}</view>
          <BaseButton
            class="state-action"
            block
            @click="getInfo"
          >
            重试
          </BaseButton>
        </view>
        <template v-else>
          <view class="hero">
            <image
              :src="avatar"
              class="avatar pressable"
              mode="aspectFill"
              @tap="toUserInfoPage"
            />
            <view class="hero-copy">
              <view class="name">
                {{ nickname || '未填写昵称' }}
              </view>
              <view class="handle">
                乡声号 {{ username || '未设置' }}
              </view>
              <view class="bio">
                {{ bioText }}
              </view>
              <view class="meta-row">
                <view
                  v-if="primaryDialect"
                  class="dialect-badge"
                >
                  {{ locationText }}
                </view>
                <view
                  v-else
                  class="meta"
                >
                  未填写方言点
                </view>
                <view
                  v-if="titleLabel"
                  class="title-badge"
                >
                  {{ titleLabel }}
                </view>
              </view>
            </view>
          </view>

          <view class="social-stats">
            <view
              class="social-stat pressable"
              @tap="toCanLibrary"
            >
              <view class="number">
                {{ cansCount }}
              </view>
              <view class="label">
                录音
              </view>
            </view>
            <view class="social-stat">
              <view class="number">
                {{ followingCount }}
              </view>
              <view class="label">
                关注
              </view>
            </view>
            <view class="social-stat">
              <view class="number">
                {{ followerCount }}
              </view>
              <view class="label">
                粉丝
              </view>
            </view>
          </view>

          <view class="profile-actions">
            <view class="action-slot">
              <BaseButton
                variant="ghost"
                size="small"
                block
                @click="toUserInfoPage"
              >
                编辑资料
              </BaseButton>
            </view>
            <view class="action-slot">
              <BaseButton
                variant="ghost"
                size="small"
                block
                @click="toMailsPage"
              >
                {{ unreadMailsCount > 0 ? `消息 ${unreadMailsCount}` : '消息' }}
              </BaseButton>
            </view>
            <view class="action-slot">
              <BaseButton
                size="small"
                block
                @click="toCreate"
              >
                录乡音
              </BaseButton>
            </view>
          </view>

          <view
            v-if="followedDialects.length"
            class="dialect-follow"
          >
            <view class="section-kicker">
              关注的方言
            </view>
            <view class="chip-row">
              <view
                v-for="dialect in followedDialects"
                :key="dialect.id"
                class="dialect-badge"
              >
                {{ dialect.name }}
              </view>
            </view>
          </view>

          <view class="works">
            <view class="works-tabs">
              <view
                class="works-tab pressable"
                :class="{ active: worksTab === 'cans' }"
                @tap="worksTab = 'cans'"
              >
                录音 {{ cansCount }}
              </view>
              <view
                class="works-tab pressable"
                :class="{ active: worksTab === 'nameplates' }"
                @tap="worksTab = 'nameplates'"
              >
                词条 {{ nameplatesCount }}
              </view>
              <view
                class="works-tab pressable"
                :class="{ active: worksTab === 'flavors' }"
                @tap="worksTab = 'flavors'"
              >
                义项 {{ flavorsCount }}
              </view>
            </view>
            <view class="works-empty">
              <view class="works-empty-title">
                {{ worksPanelTitle }}
              </view>
              <view class="works-empty-copy">
                {{ worksPanelCopy }}
              </view>
              <BaseButton
                v-if="worksCount === 0 && worksTab === 'cans'"
                class="works-empty-action"
                block
                @click="toCreate"
              >
                去录乡音
              </BaseButton>
              <BaseButton
                v-else
                class="works-empty-action"
                variant="ghost"
                block
                @click="toCanLibrary"
              >
                查看既有贡献
              </BaseButton>
            </view>
          </view>

          <view class="tool-grid">
            <view
              class="tool-item pressable"
              @tap="toCanLibrary"
            >
              <view class="tool-count">
                {{ cansCount }}
              </view>
              <view class="tool-label">
                既有录音
              </view>
            </view>
            <view
              class="tool-item pressable"
              @tap="toLikes"
            >
              <view class="tool-count">
                ·
              </view>
              <view class="tool-label">
                收藏
              </view>
            </view>
            <view
              class="tool-item pressable"
              @tap="toDrafts"
            >
              <view class="tool-count">
                {{ draftsCount }}
              </view>
              <view class="tool-label">
                草稿箱
              </view>
            </view>
          </view>

          <view class="account-section">
            <view class="section-kicker">
              贡献履历
            </view>
            <view class="account-section__copy">
              你已留下 {{ cansCount }} 段录音、参与 {{ nameplatesCount }} 个词条、
              补充 {{ flavorsCount }} 个义项。后续补证和修订也会形成可追溯记录。
            </view>
          </view>

          <view class="account-section">
            <view class="section-kicker">
              录音与授权
            </view>
            <view class="account-section__copy">
              每段录音独立保存授权说明；设备位置不会随录音上传。你可以在录音时填写引用范围。
            </view>
            <BaseButton
              class="account-section__action"
              size="small"
              variant="ghost"
              text="录一段并设置授权"
              @click="toCreate"
            />
          </view>

          <view class="account-section">
            <view class="section-kicker">
              {{ curationSummary ? '管理与审核' : '申请成为整理员' }}
            </view>
            <view class="account-section__copy">
              <template v-if="curationSummary">
                当前有 {{ curatorPending }} 项待办。词条整理与地区整理按授权范围显示，不进入 Django 系统后台。
              </template>
              <template v-else>
                熟悉本地方言写法、读音或资料来源？可申请词条整理或地区整理权限；授权范围和期限会公开记录。
              </template>
            </view>
          </view>

          <view class="menu">
            <view class="section-kicker menu-kicker">
              主题
            </view>
            <view
              class="menu-item pressable"
              @tap="toThemeCenter"
            >
              <view>主题中心</view>
              <view class="menu-value">
                {{ themeLabel }}
              </view>
            </view>
          </view>

          <view class="menu">
            <view class="section-kicker menu-kicker">
              个人资料、隐私与安全
            </view>
            <view
              class="menu-item pressable"
              @tap="toUserInfoPage"
            >
              <view>个人资料与隐私</view>
              <view class="menu-value">
                查看与修改
              </view>
            </view>
            <view
              class="menu-item pressable"
              @tap="toEmailPage"
            >
              <view>邮箱</view>
              <view class="menu-value">
                {{ emailLabel }}
              </view>
            </view>
            <view
              class="menu-item pressable"
              @tap="toChangePasswordPage"
            >
              修改密码
            </view>
            <view
              v-if="showWechatMenu"
              class="menu-item pressable"
              :class="{ busy: isBinding }"
              @tap="onWechatMenuTap"
            >
              <view>微信</view>
              <view class="menu-value">
                {{ wechatStatusText }}
              </view>
            </view>
            <view
              class="menu-item danger pressable"
              @tap="exit"
            >
              退出登录
            </view>
          </view>
        </template>
      </template>

      <template v-else>
        <view class="guest-profile">
          <view class="guest-mark">
            乡
          </view>
          <view class="guest-title">
            还没有登录
          </view>
          <view class="guest-copy">
            登录后可以录乡音、看草稿和自己的贡献。公开乡音不用登录，先听也可以。
          </view>
          <BaseButton
            class="guest-action login-button"
            block
            @click="openLoginFromMine"
          >
            登录 / 注册
          </BaseButton>
          <BaseButton
            class="guest-action"
            variant="ghost"
            block
            @click="toHome"
          >
            先去听乡音
          </BaseButton>
          <BaseButton
            class="guest-action"
            variant="ghost"
            block
            @click="toSearch"
          >
            先去查词
          </BaseButton>
        </view>
        <view class="menu guest-theme">
          <view class="section-kicker menu-kicker">
            主题
          </view>
          <view
            class="menu-item pressable"
            @tap="toThemeCenter"
          >
            <view>主题中心</view>
            <view class="menu-value">
              {{ themeLabel }}
            </view>
          </view>
        </view>
      </template>
    </view>
  </AppShell>
</template>

<script>
import AppShell from '@/components/AppShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import confirmDialog from '@/components/ConfirmDialog';
import { notify, notifySuccess } from '@/services/feedback';
import { openLoginFromMine } from '@/services/authJourney';
import { listCanDrafts } from '@/services/canDrafts';
import { getCurationSummary } from '@/services/entryRecording';
import {
  goCanLibrary,
  goHome,
  goMails,
  goRecord,
  goSearch,
  goThemeCenter,
  goUserEmail,
  goUserInformation,
  goUserPassword,
} from '@/services/navigation';
import canUseWechatMiniProgramAuth from '@/services/platform';
import { resolveSessionUserId } from '@/services/session';
import { getActiveTheme } from '@/services/themeCenter';
import {
  bindingWechat as bindingWechatService,
  cancelBindingWechat as cancelBindingWechatService,
  clearUserInfo,
  getUserInfo,
} from '@/services/user';

export default {
  components: { AppShell, BaseButton },
  data() {
    return {
      id: '',
      avatar: '',
      nickname: '',
      username: '',
      titleLabel: '',
      primaryDialect: null,
      cansCount: 0,
      flavorsCount: 0,
      nameplatesCount: 0,
      followerCount: 0,
      followingCount: 0,
      draftsCount: 0,
      unreadMailsCount: 0,
      followedDialects: [],
      email: '',
      wechatBound: false,
      canUseWechatAuth: canUseWechatMiniProgramAuth(),
      isBinding: false,
      loading: Boolean(uni.getStorageSync('token')),
      loadError: '',
      loggedIn: Boolean(uni.getStorageSync('token')),
      worksTab: 'cans',
      curationSummary: null,
    };
  },
  computed: {
    locationText() {
      return this.primaryDialect?.name || '未填写方言点';
    },
    bioText() {
      const dialect = this.locationText;
      if (this.titleLabel) return `${this.titleLabel} · ${dialect}`;
      return `在「${dialect}」记录乡音`;
    },
    worksCount() {
      if (this.worksTab === 'nameplates') return this.nameplatesCount;
      if (this.worksTab === 'flavors') return this.flavorsCount;
      return this.cansCount;
    },
    worksPanelTitle() {
      if (this.worksCount > 0) {
        if (this.worksTab === 'nameplates') return `参与 ${this.worksCount} 个词条`;
        if (this.worksTab === 'flavors') return `补充 ${this.worksCount} 个义项`;
        return `留下 ${this.worksCount} 段录音`;
      }
      if (this.worksTab === 'nameplates') return '还没有参与词条整理';
      if (this.worksTab === 'flavors') return '还没有补充义项';
      return '还没有录音贡献';
    },
    worksPanelCopy() {
      if (this.worksCount > 0) {
        return '既有贡献仍可查看；新录音会按词条和地区建立可追溯关联。';
      }
      if (this.worksTab === 'nameplates') {
        return '不会写汉字也没关系，先录音和说明大意，之后再逐步完善词条。';
      }
      if (this.worksTab === 'flavors') {
        return '义项记录同一个词条下相关的编号义、用法和例句。';
      }
      return '录下一个你会说的词或短语，只需标明地区并说明大意。';
    },
    emailLabel() {
      return this.email || '未绑定';
    },
    showWechatMenu() {
      return this.canUseWechatAuth || this.wechatBound;
    },
    wechatStatusText() {
      if (this.isBinding) return this.wechatBound ? '解绑中…' : '绑定中…';
      if (this.wechatBound) return '已绑定 · 点此解绑';
      return '未绑定 · 点此授权';
    },
    themeLabel() {
      return getActiveTheme().name;
    },
    curatorPending() {
      const pending = this.curationSummary?.pending || {};
      return Object.values(pending).reduce((total, value) => total + Number(value || 0), 0);
    },
  },
  beforeMount() {
    this.getInfo();
  },
  onShow() {
    this.loggedIn = Boolean(uni.getStorageSync('token'));
    this.refreshDraftsCount();
    if (this.loggedIn) this.getInfo();
  },
  methods: {
    toMailsPage() {
      goMails();
    },
    toChangePasswordPage() {
      goUserPassword();
    },
    toEmailPage() {
      goUserEmail();
    },
    toThemeCenter() {
      goThemeCenter();
    },
    toUserInfoPage() {
      goUserInformation();
    },
    openLoginFromMine,
    toSearch() {
      goSearch();
    },
    toHome() {
      goHome();
    },
    toCreate() {
      goRecord();
    },
    toDrafts() {
      goCanLibrary({ tab: 'drafts' });
    },
    toLikes() {
      goCanLibrary({ tab: 'liked' });
    },
    refreshDraftsCount() {
      this.draftsCount = listCanDrafts().length;
    },
    toCanLibrary() {
      goCanLibrary();
    },
    async getInfo() {
      const id = resolveSessionUserId();
      if (!id) {
        this.loading = false;
        if (!uni.getStorageSync('token')) this.loggedIn = false;
        return;
      }
      this.loading = true;
      this.loadError = '';
      try {
        const userInfo = await getUserInfo(id, true);
        this.id = userInfo.user.id;
        this.avatar = userInfo.user.avatar;
        this.username = userInfo.user.username || '';
        this.nickname = userInfo.user.nickname || userInfo.user.username;
        this.titleLabel = userInfo.user.title?.title || '';
        this.primaryDialect = userInfo.user.primary_dialect;
        this.cansCount = userInfo.contribution.cans_uploaded
          ?? userInfo.contribution.cans
          ?? 0;
        this.flavorsCount = userInfo.contribution.flavors_uploaded
          ?? userInfo.contribution.flavors
          ?? 0;
        this.nameplatesCount = userInfo.contribution.nameplates_uploaded
          ?? userInfo.contribution.nameplates
          ?? 0;
        this.followerCount = userInfo.user.follower_count || 0;
        this.followingCount = userInfo.user.following_count || 0;
        this.followedDialects = userInfo.user.followed_dialects || [];
        this.unreadMailsCount = userInfo.notification
          ? userInfo.notification.statistics.unread
          : 0;
        this.email = userInfo.user.email || '';
        this.wechatBound = Boolean(userInfo.user.wechat);
        await this.loadCurationSummary();
      } catch (error) {
        this.loadError = error?.message || '档案加载失败，请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
    async loadCurationSummary() {
      try {
        this.curationSummary = await getCurationSummary();
      } catch (error) {
        this.curationSummary = null;
      }
    },
    async exit() {
      const confirmed = await confirmDialog({
        title: '退出登录？',
        content: '退出后将回到游客模式，本地草稿仍会保留。',
        confirmText: '退出',
        danger: true,
      });
      if (!confirmed) return;
      clearUserInfo();
      goHome(true);
      notifySuccess('登出成功');
    },
    async onWechatMenuTap() {
      const id = resolveSessionUserId();
      if (this.isBinding || !id) return;
      if (this.wechatBound) {
        await this.unbindWechat(id);
        return;
      }
      if (!this.canUseWechatAuth) return;
      await this.bindWechat(id);
    },
    async bindWechat(id) {
      const confirmed = await confirmDialog({
        title: '绑定当前微信？',
        content: '绑定后可用这个微信一键登录。头像请到编辑资料里授权，昵称请到修改昵称里填入。',
        confirmText: '去授权',
      });
      if (!confirmed) return;
      this.isBinding = true;
      try {
        await bindingWechatService(id, false);
        notifySuccess('绑定成功');
        await this.getInfo();
        const goEdit = await confirmDialog({
          title: '要用微信头像吗？',
          content: '去编辑资料可授权微信头像；去修改昵称可填入微信昵称。',
          confirmText: '去编辑资料',
          cancelText: '稍后',
        });
        if (goEdit) goUserInformation();
      } catch (err) {
        await this.handleBindError(id, err);
      } finally {
        this.isBinding = false;
      }
    },
    async handleBindError(id, err) {
      const message = err?.message || '绑定失败，请检查网络后重试';
      if (err?.statusCode === 409 && message.includes('该账户已绑定微信')) {
        const overwrite = await confirmDialog({
          title: '更换绑定的微信？',
          content: '这个账号已经绑过微信。要用现在这个微信替换吗？',
          confirmText: '替换',
        });
        if (!overwrite) return;
        try {
          await bindingWechatService(id, true);
          notifySuccess('绑定成功');
          await this.getInfo();
        } catch (retryError) {
          notify({ title: retryError?.message || '绑定失败，请检查网络后重试' });
        }
        return;
      }
      notify({ title: message });
    },
    async unbindWechat(id) {
      if (!this.email) {
        const goEmail = await confirmDialog({
          title: '还不能解绑',
          content: '解绑前请先绑定邮箱，否则可能无法再登录这个账号。',
          confirmText: '去绑定邮箱',
        });
        if (goEmail) goUserEmail();
        return;
      }
      const confirmed = await confirmDialog({
        title: '解绑微信？',
        content: '解绑后不能再用这个微信登录，邮箱和密码登录不受影响。',
        confirmText: '解绑',
        danger: true,
      });
      if (!confirmed) return;
      this.isBinding = true;
      try {
        await cancelBindingWechatService(id);
        notifySuccess('解绑成功');
        await this.getInfo();
      } catch (err) {
        notify({ title: (err && err.message) || '解绑失败，请检查网络后重试' });
      } finally {
        this.isBinding = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  color: var(--dress-home-bg-color, var(--text-color));
  background: var(--dress-home-bg-background, transparent);
}

.state-card,
.guest-profile {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-sizing: border-box;
}

.state-card {
  color: var(--text-secondary-color);
}

.state-action {
  margin-top: var(--space-3);
}

.guest-profile {
  max-width: 620rpx;
  margin: 8vh auto 0;
  text-align: center;
}

.guest-mark {
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  color: var(--on-accent-color);
  font-size: var(--font-size-xl);
  font-weight: 800;
  line-height: 160rpx;
}

.guest-title {
  margin-top: var(--space-3);
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.guest-copy {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.guest-action {
  margin-top: var(--space-3);
}

.guest-theme {
  text-align: left;
}

.hero {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar {
  width: 168rpx;
  height: 168rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--dress-avatar-frame-color, inherit);
  border:
    var(--dress-avatar-frame-border-width, 0px)
    solid var(--dress-avatar-frame-border-color, transparent);
  box-sizing: border-box;
  flex-shrink: 0;
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.name {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.handle,
.bio,
.meta {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.bio {
  line-height: 1.5;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.dialect-badge,
.title-badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.dialect-badge {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.title-badge {
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
}

.social-stats {
  display: flex;
  margin-top: var(--space-4);
}

.social-stat {
  flex: 1;
}

.number {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.label,
.tool-label {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.profile-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.action-slot {
  flex: 1;
  min-width: 0;
}

.dialect-follow {
  margin-top: var(--space-4);
}

.section-kicker {
  margin-bottom: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.works,
.tool-grid,
.menu,
.account-section {
  margin-top: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  overflow: hidden;
}

.account-section {
  padding: var(--space-3);
}

.account-section__copy {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.account-section__action {
  margin-top: var(--space-3);
}

.works-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.works-tab {
  flex: 1;
  padding: var(--space-3) 0;
  text-align: center;
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.works-tab.active {
  color: var(--text-color);
  font-weight: 700;
  box-shadow: inset 0 -4rpx 0 var(--accent-color);
}

.works-empty {
  padding: var(--space-5) var(--space-3);
  text-align: center;
}

.works-empty-title {
  font-weight: 700;
}

.works-empty-copy {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.works-empty-action {
  margin-top: var(--space-3);
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: var(--space-3) 0;
}

.tool-item {
  position: relative;
  text-align: center;
}

.tool-count {
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.menu-item {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.menu-item:last-child {
  border-bottom: 0;
}

.menu-item.busy {
  opacity: 0.72;
}

.menu-value {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.danger {
  color: var(--danger-color);
}

.menu-kicker {
  margin: var(--space-3) var(--space-3) 0;
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
