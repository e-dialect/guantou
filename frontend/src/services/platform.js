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
