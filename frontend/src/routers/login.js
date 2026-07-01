/**
 * 前往忘记密码页面
 */
export function toForgetPage() {
  uni.navigateTo({
    url: '/pages/login/forget',
  });
}

/**
 * 前往登录页面
 */
export function toLoginPage() {
  const routes = getCurrentPages();
  if (routes[routes.length - 1].route !== '/pages/login/login' && routes[routes.length - 1].route !== 'pages/login/login') {
    uni.navigateTo({
      url: '/pages/login/login',
    });
  }
}

/**
 * 前往微信注册页面
 */
export function toRegisterPage() {
  uni.navigateTo({
    url: '/pages/login/register',
  });
}

/**
 * 前往微信注册页面
 */
export function toWechatRegisterPage() {
  uni.navigateTo({
    url: '/pages/login/register/wechat',
  });
}
