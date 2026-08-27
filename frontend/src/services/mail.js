import request from '@/utils/request';

export function postMail(notification, silent = false) {
  return request.post('/notifications', notification, silent);
}

/* 获取用户所有的通知
*/
export async function getAllMails(page) {
  return request.get('/notifications', { page });
}

export function listNotifications(params = {}) {
  return request.get('/notifications', params);
}

export function markNotificationsRead(notificationIds = null) {
  const payload = Array.isArray(notificationIds)
    ? { notifications: notificationIds }
    : {};
  return request.put('/notifications/unread', payload);
}

/* 获取某个通知的详情
*/
export async function getMailDetails(id) {
  return request.get(`/notifications/${id}`);
}
