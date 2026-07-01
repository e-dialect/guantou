export const COS_URL = 'https://cos.edialect.top/miniprogram';

export const BASE_URL = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.MODE === 'production'
    ? ''
    : 'http://localhost:8000');

export const DefaultAnnouncementCover = 'https://cos.edialect.top/website/默认封面.png';
