import request from '@/utils/request';

export async function getAnnouncements() {
  return (await request.get('/site-settings/announcements')).announcements;
}

export async function getFeaturedAnnouncements() {
  return (await request.get('/site-settings/featured-announcements')).featured_announcements;
}
