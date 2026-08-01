let currentAudioContext = null;

function stopCurrentAudio() {
  if (!currentAudioContext) return;
  currentAudioContext.stop();
  if (typeof currentAudioContext.destroy === 'function') {
    currentAudioContext.destroy();
  }
  currentAudioContext = null;
}

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

  stopCurrentAudio();
  const innerAudioContext = uni.createInnerAudioContext();
  currentAudioContext = innerAudioContext;
  innerAudioContext.onError(() => {
    uni.showToast({
      title: '播放失败',
      icon: 'none',
    });
    stopCurrentAudio();
  });
  innerAudioContext.onEnded(() => {
    if (currentAudioContext === innerAudioContext) {
      currentAudioContext = null;
    }
  });

  uni.showToast({
    title: '正在播放...',
    icon: 'none',
  });

  innerAudioContext.src = src;
  innerAudioContext.play();
}

export function stopAudio() {
  stopCurrentAudio();
}
