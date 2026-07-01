/**
 * 复制数据到剪切板
 * @param data{string} 复制文本
 * @param quiet{boolean} 无需提示
 */
export function setClipboard(data, quiet = false) {
  uni.setClipboardData({
    data,
    success() {
      if (!quiet) {
        uni.showToast({
          title: '已复制',
          icon: 'none',
        });
      }
    },
    fail() {
      uni.showToast({
        title: '复制失败',
        icon: 'none',
      });
    },
  });
}

/**
 * 安静地设置剪切板
 * @param data{string} 数据
 */
export function setClipboardQuiet(data) {
  setClipboard(data, true);
}
