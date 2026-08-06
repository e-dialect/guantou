import { toIndexPage } from '@/routers';
import { toMePage } from '@/routers/user';
import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  peekInterceptIntent,
} from '@/services/authGuard';
import {
  claimAnonymousCanDrafts,
  getCanDraftOwnerScope,
} from '@/services/canDrafts';
import rawRequest from '../utils/rawRequest';

export function resumeInterruptedPageAfterLogin(loggedInUserId = uni.getStorageSync('id')) {
  const pages = getCurrentPages();
  const previousPage = pages.length > 1 ? pages[pages.length - 2] : null;
  const previousRoute = previousPage ? previousPage.route : '';
  const interruptedIntent = peekInterceptIntent();
  const previousIsCanCreate = previousRoute === 'pages/cans/create'
    || previousRoute === '/pages/cans/create';

  if (interruptedIntent?.action !== 'record_can') return false;
  const isCanCreateIntent = interruptedIntent.context?.page === 'can_create'
    && interruptedIntent.context?.returnRoute === '/pages/cans/create';
  if (!isCanCreateIntent) {
    clearInterceptIntent();
    return false;
  }
  if (!previousIsCanCreate) {
    clearInterceptIntent();
    return false;
  }
  const intendedOwner = interruptedIntent.context?.ownerScope || '';
  if (intendedOwner.startsWith('user:') && intendedOwner !== `user:${loggedInUserId}`) {
    clearInterceptIntent();
    uni.showToast({ title: '该草稿属于其他账号', icon: 'none' });
    toMePage(true);
    return true;
  }
  clearInterceptIntent();
  uni.navigateBack({ delta: 1 });
  return true;
}

/**
 * 加载用户信息到 app.globalData
 */
export async function loadUserInfo() {
  const id = uni.getStorageSync('id');
  if (!id) {
    return;
  }
  const app = getApp();
  await rawRequest.get(`/users/${id}`).then((res) => {
    app.globalData.userInfo = res.user;
    app.globalData.contribution = res.contribution;
    app.globalData.id = res.user.id;
  });
}

export async function afterLogin(res) {
  uni.showToast({
    title: '登录成功',
    icon: 'success',
  });
  const previousOwnerScope = getCanDraftOwnerScope();
  uni.setStorageSync('token', res.token);
  uni.setStorageSync('id', res.id);
  if (previousOwnerScope.startsWith('anonymous:')) {
    await claimAnonymousCanDrafts(res.id, previousOwnerScope);
  }
  await loadUserInfo();
  if (resumeInterruptedPageAfterLogin(res.id)) return;
  // #ifdef H5
  toIndexPage(true);
  // #endif
  // #ifndef H5
  toMePage();
// #endif
}

/**
 * 小程序一键登录
 */
/**
 * 生成安全的随机密码
 */
function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * 使用微信 code 进行一键注册
 */
async function registerWithWechatCode(code) {
  // 自动生成用户名和密码
  const username = `wx_${generateSecurePassword(8)}`;
  const password = generateSecurePassword(16);

  // 不再调用 uni.getUserProfile（小程序基础库限制），只提交必需字段
  // 发送注册请求（仅必填项）
  return rawRequest.post('/users/wechat/register', {
    jscode: code,
    username,
    password,
  }, { auth: false })
    .then(async (res) => {
      await afterLogin(res);
      return res;
    })
    .catch((err) => {
      // 不在此处直接弹窗，保留原行为：提示给用户
      uni.showToast({
        title: err.data && err.data.msg ? err.data.msg : (err.msg || '注册失败'),
        icon: 'none',
      });
      throw err;
    });
}

export async function mpLogin() {
  // #ifdef H5
  toLoginPage();
  // #endif

  // #ifndef H5
  uni.login({
    // 尝试调用登录接口成功
    success: (res) => {
      // 如果没有获取到微信的 code 直接使用普通登录
      if (!res.code) {
        toLoginPage();
        return;
      }
      // 尝试进行微信登录
      rawRequest.post(
        '/login/wechat',
        {
          jscode: res.code,
        },
        { auth: false },
      )
        .then(async (res2) => {
          await afterLogin(res2);
        })
        .catch((err) => {
          switch (err.statusCode) {
            case 404:
              uni.showModal({
                content: '当前微信未绑定账号，是否一键注册？',
                success(modalRes) {
                  if (modalRes.confirm) {
                    // jscode 是一次性凭证，之前用于登录尝试已可能被后端消费，
                    // 因此再次调用 uni.login() 获取新的 code 用于注册。
                    uni.login({
                      success: (res2) => {
                        if (!res2.code) {
                          uni.showToast({ title: '获取微信授权失败', icon: 'none' });
                          return;
                        }
                        // 使用新的 code 进行注册
                        registerWithWechatCode(res2.code);
                      },
                      fail() {
                        uni.showToast({ title: '获取微信授权失败', icon: 'none' });
                      },
                    });
                  } else {
                    // 跳转到普通登录页面
                    toLoginPage();
                  }
                },
              });
              break;
            default:
              uni.showToast({
                title: err.data.msg || '登录失败',
              });
          }
        });
    },
    // 尝试调用登录接口失败
    fail() {
      // 跳转到账号密码登录页面
      toLoginPage();
    },
  });
  // #endif
}

/**
 * 账号密码登录
 * @param username 用户名
 * @param password 密码
 */
export async function normalLogin(username, password) {
  if (!username) {
    uni.showToast({
      title: '请输入用户名',
      icon: 'error',
    });
    return;
  }
  if (!password) {
    uni.showToast({
      title: '请输入密码',
      icon: 'error',
    });
    return;
  }
  rawRequest.post('/login', {
    username,
    password,
  }, { auth: false }).then(async (res) => {
    await afterLogin(res);
  }).catch((err) => {
    switch (err.statusCode) {
      case 401:
        uni.showToast({
          title: err.data.msg || '用户名或密码错误',
          icon: 'error',
        });
        break;
      default:
        uni.showToast({
          title: err.data.msg || '登录失败',
        });
    }
  });
}

/**
 * 更新 Token 并登录
 * @returns {Promise<boolean>} 是否登录成功
 */
export async function getLoginStatus() {
  if (!uni.getStorageSync('token')) {
    return false;
  }

  let flag = false;
  await rawRequest.put('/login', {}).then(async (res) => {
    uni.setStorageSync('token', res.token);
    uni.setStorageSync('id', res.id);
    await loadUserInfo();
    flag = true;
  }).catch((err) => {
    switch (err.statusCode) {
      case 401:
        if (!uni.getStorageSync('token')) break;
        uni.removeStorageSync('token');
        uni.removeStorageSync('id');
        uni.showToast({
          title: err.data.msg || '登录已过期，请重新登录',
          icon: 'error',
        });
        break;
      default:
        break;
    }
  });
  return flag;
}

export function getLoginStatusSync() {
  return !!(uni.getStorageSync('token'));
}
