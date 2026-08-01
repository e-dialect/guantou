/**
 * 跳转至首页
 */
export function toIndexPage(closeAll = false) {
  if (closeAll) {
    uni.reLaunch({
      url: '/pages/index',
    });
  } else {
    uni.navigateTo({
      url: '/pages/index',
    });
  }
}

/**
 * 前往搜索页面
 */
export function toSearchPage() {
  uni.navigateTo({
    url: '/pages/search',
  });
}

/**
 * 接入兔小巢
 * @returns {Promise<void>}
 */
export function toTuxiaochaoPage() {
  switch (uni.getSystemInfoSync().uniPlatform) {
    case 'mp-weixin':
      uni.openEmbeddedMiniProgram(
        {
          appId: 'wx8abaf00ee8c3202e',
          extraData: {
            id: '420021',
          },
          fail() {
            uni.navigateToMiniProgram({
              appId: 'wx8abaf00ee8c3202e',
              extraData: {
                id: '420021',
              },
              fail() {
                uni.showToast({
                  title: '跳转失败！',
                  icon: 'none',
                });
              },
            });
          },
        },
      );
      break;
    case 'web':
      // 跳转到乡声集盒反馈页面
      window.location = 'https://support.qq.com/product/420021';
      break;
    default:
      uni.showToast({
        title: '暂不支持此平台！',
        icon: 'none',
      });
  }
}
