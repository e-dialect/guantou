/**
 * 前往用户页面
 * @param id 用户id
 */
export function toUserPage(id) {
  uni.navigateTo({
    url: `/pages/users/details?id=${id}`,
  });
}

/**
 * 前往用户信息页面
 */
export function toUserInfoPage() {
  uni.navigateTo({
    url: '/pages/users/settings/information',
  });
}

/**
 * 前往更改用户昵称页面
 */
export function toChangeNicknamePage() {
  uni.navigateTo({
    url: '/pages/users/settings/nickname',
  });
}

/**
 * 前往更改用户名页面
 */
export function toChangeUsernamePage() {
  uni.navigateTo({
    url: '/pages/users/settings/username',
  });
}

/**
 * 前往更改邮箱页面
 */
export function toChangeEmailPage() {
  uni.navigateTo({
    url: '/pages/users/settings/email',
  });
}

/**
 * 前往更改手机号页面
 */
export function toChangePhonePage() {
  uni.navigateTo({
    url: '/pages/users/settings/telephone',
  });
}

/**
 * 前往更改密码页面
 */
export function toChangePasswordPage() {
  uni.navigateTo({
    url: '/pages/users/settings/password',
  });
}

/**
 * 前往个人页面
 * @param closeAll
 */
export function toMePage(closeAll = false) {
  if (closeAll) {
    uni.reLaunch({
      url: '/pages/index?status=me',
    });
  } else {
    uni.navigateTo({
      url: '/pages/index?status=me',
    });
  }
}
