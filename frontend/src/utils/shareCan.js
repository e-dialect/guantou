import { APP_NAME } from '@/const/branding';

export function canSharePayload(can = {}) {
  const label = can.primary_nameplate?.display_text || can.concept_text || '一罐乡音';
  return {
    title: `${label} · ${APP_NAME}`,
    path: `/pages/cans/details?id=${can.id}`,
  };
}

export async function shareCanOnWeb(can) {
  const payload = canSharePayload(can);
  const relativeUrl = `${payload.path}`;
  const url = typeof window !== 'undefined'
    ? new URL(relativeUrl, window.location.origin).toString()
    : relativeUrl;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: payload.title, url });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
  }
  await new Promise((resolve, reject) => {
    uni.setClipboardData({
      data: url,
      success: resolve,
      fail: reject,
    });
  });
  uni.showToast({ title: '链接已复制', icon: 'none' });
  return true;
}

export default {
  canSharePayload,
  shareCanOnWeb,
};
