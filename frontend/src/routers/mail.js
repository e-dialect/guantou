/**
 * 前往邮件详情界面
 */

export function toMailDetailsPage(id) {
  uni.navigateTo({
    url: `/pages/mails/details?id=${id}`,
  });
}

/**
 * 前往发送邮件界面
 */
export function toMailsSendingPage() {
  uni.navigateTo({
    url: '/pages/mails/send',
  });
}

/**
 * 前往邮件主界面
 */
export function toMailsPage() {
  uni.navigateTo({
    url: '/pages/mails/index',
  });
}
