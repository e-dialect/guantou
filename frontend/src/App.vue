<script>
import { goNotFound } from '@/services/navigation';
// app.js
import { getLoginStatus } from '@/services/login';
import {
  ensureDialectOnboarding,
  ONBOARDING_REASONS,
} from '@/services/dialectOnboarding';
import { toIndexPage } from '@/routers/index';
import { applyTheme } from '@/services/theme';
import pagesJson from '@/pages.json';

export default {
  data() {
    return {};
  },
  async onLaunch() {
    applyTheme();
    if (uni.getSystemInfoSync().uniPlatform === 'web') {
      const pages = pagesJson.pages.map((page) => `/${page.path}`);
      const currentPath = window.location.pathname;
      // Handle root path '/' by redirecting to the index page (home page)
      if (currentPath === '/' || currentPath === '') {
        toIndexPage(true);
      } else if (!pages.includes(currentPath)) {
        goNotFound();
      }
    }

    uni.getSystemInfo({
      success: (e) => {
        this.globalData.platform = e.platform;
        this.globalData.StatusBar = e.statusBarHeight;
        const capsule = uni.getMenuButtonBoundingClientRect();

        if (capsule) {
          this.globalData.Custom = capsule;
          this.globalData.CustomBar = capsule.bottom + capsule.top - e.statusBarHeight;
        } else {
          this.globalData.CustomBar = e.statusBarHeight + 50;
        }
      },
    });
    const loggedIn = await getLoginStatus();
    if (loggedIn) {
      ensureDialectOnboarding(
        this.globalData.userInfo,
        ONBOARDING_REASONS.MISSING_DIALECT,
      );
    }
  },
  globalData: {
    userInfo: {
      avatar: '',
      nickname: '',
    },
    platform: '',
    StatusBar: 0,
    Custom: null,
    CustomBar: 0,
    contribution: 0,
    id: null,
    showRedirectTips: false,
    comment: null,
    watch(method) {
      const obj = this;
      Object.defineProperty(obj, 'data', {
        configurable: true,
        enumerable: true,
        set(value) {
          if (value.avatar) {
            this.userInfo.avatar = value.avatar;
          }

          if (value.nickname) {
            this.userInfo.nickname = value.nickname;
          }

          method(value);
        },
        get() {
          return this;
        },
      });
    },
  },
};
</script>
<style lang="scss">
/* 全局 Design Tokens：全站颜色/间距/圆角/字号唯一来源（M1·设计系统） */
@import '@/styles/tokens.scss';
</style>

<style>
@import 'colorui/main.css';
@import 'colorui/icon.css';
@import '@/utils/u-parse/u-parse.css';
@import '@/styles/legacy-form-compat.scss';

page {
  background-color: var(--page-color);
  color: var(--text-color);
}

/* #ifdef H5 */
html[data-theme='dark'],
html[data-theme='dark'] page {
  background: var(--page-color);
  color-scheme: dark;
}
/* #endif */

.scrollPage {
  height: 100vh;
}

.layout-index {
  position: absolute;
  top: 45%;
  width: 100vw;
}

.layout-index-login {
  position: absolute;
  top: 33%;
  width: 100vw;
}

.index-card {
  background-color: #ffffff;
  padding: 30rpx 30rpx;
  border-radius: 20rpx;
  margin: 5vw;
}

.card-name {
  color: #115e83;
  font-size: 36rpx;
  font-weight: 700;
}

.card-slogan {
  color: black;
  margin-top: 10rpx;
  font-size: 32rpx;
  font-weight: 300;
}

.card-btn {
  position: absolute;
  right: 10vw;
  top: 6vh;
  font-size: 26rpx;
}

.index-word {
  background-color: #ffffff;
  border-radius: 20rpx;
  height: 25vh;
  margin: 5vw;
}

.word-sy {
  display: -webkit-box;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
  overflow: hidden;
  text-overflow: ellipsis;
}

.index-search {
  background-color: #ffffff;
  border-radius: 20rpx;
  margin: 5vw;
}

.stand-view {
  height: 10vh;
}

.login-input {
  background-color: #f2f3f7;
  border-radius: 5000rpx;
  display: flex;
  margin: 30rpx 60rpx;
  padding: 20rpx;
}

.btn {
  margin: 10vh auto;
  background-color: white;
}
</style>
