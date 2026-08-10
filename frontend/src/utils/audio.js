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
  uni.showToast({
    title: '正在播放...',
    icon: 'none',
  });
  // #ifdef H5
  const audioElement = new Audio(src);
  let webAudioContext = null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const resolvedUrl = new URL(src, window.location.href);
    const canUseWebAudio = AudioContextClass
      && (resolvedUrl.origin === window.location.origin || resolvedUrl.protocol === 'blob:');
    if (canUseWebAudio) {
      webAudioContext = new AudioContextClass();
      const source = webAudioContext.createMediaElementSource(audioElement);
      source.connect(webAudioContext.destination);
    }
  } catch (error) {
    webAudioContext = null;
  }
  const webPlayback = {
    stop() {
      audioElement.pause();
      audioElement.currentTime = 0;
    },
    destroy() {
      audioElement.src = '';
      if (webAudioContext && typeof webAudioContext.close === 'function') {
        webAudioContext.close();
      }
    },
  };
  currentAudioContext = webPlayback;
  audioElement.onerror = () => {
    uni.showToast({ title: '播放失败', icon: 'none' });
    stopCurrentAudio();
  };
  audioElement.onended = () => {
    if (currentAudioContext === webPlayback) stopCurrentAudio();
  };
  const playPromise = audioElement.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      uni.showToast({ title: '播放失败', icon: 'none' });
      stopCurrentAudio();
    });
  }
  // #endif

  // #ifndef H5
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

  innerAudioContext.src = src;
  innerAudioContext.play();
  // #endif
}

export function stopAudio() {
  stopCurrentAudio();
}
