/**
 * 播放音频
 * @param src 音频地址
 * @param warn 是否警告
 */
// eslint-disable-next-line import/prefer-default-export
export function playAudio(src, warn = true) {
  if (!src || src === 'null') {
    if (warn) {
      uni.showToast({
        title: '不是一个可用文件',
        icon: 'error',
      });
    }
    return;
  }

  // 播放录音文件用
  const innerAudioContext = uni.createInnerAudioContext();
  innerAudioContext.onError(() => {
    uni.showToast({
      title: '播放失败',
      icon: 'none',
    });
  });

  uni.showToast({
    title: '正在播放...',
    icon: 'none',
  });

  innerAudioContext.src = src;
  innerAudioContext.play();
}
