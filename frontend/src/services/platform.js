/**
 * WeChat mini-program open capabilities (uni.login, chooseAvatar, nickname).
 * uni-app keeps only one branch at compile time. Vitest keeps both comments,
 * so the ifndef assignment must come last to match the H5 test runtime.
 */
export default function canUseWechatMiniProgramAuth() {
  let enabled = false;
  // #ifdef MP-WEIXIN
  enabled = true;
  // #endif
  // #ifndef MP-WEIXIN
  enabled = false;
  // #endif
  return enabled;
}

/** Same compile-time branch as WeChat auth: H5 false, mp-weixin true. */
export function isWechatMiniProgram() {
  return canUseWechatMiniProgramAuth();
}

/**
 * Runtime H5 detection for code paths shared by every compiled target.
 * Prefer an already available system-info payload so startup code does not
 * need to ask uni-app for the same data twice.
 */
export function isH5Runtime(systemInfo = null) {
  if (systemInfo?.uniPlatform) return systemInfo.uniPlatform === 'web';
  if (typeof uni === 'undefined' || typeof uni.getSystemInfoSync !== 'function') return false;
  try {
    return uni.getSystemInfoSync().uniPlatform === 'web';
  } catch {
    return false;
  }
}
