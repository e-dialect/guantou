import request from '@/utils/request';

export async function postMail(notification) {
  try {
    const response = await request.post('/notifications', notification);
    // 请求成功时显示成功提示框
    uni.showToast({
      title: '请求成功',
      icon: 'success',
      duration: 2000,
    });
    return response; // 可根据需要返回响应数据
  } catch (error) {
    // 请求失败时显示失败提示框
    uni.showToast({
      title: '请求失败',
      icon: 'none',
      duration: 2000,
    });
    throw error; // 抛出错误以便上层处理
  }
}

/* 获取用户所有的通知
*/
export async function getAllMails(page) {
  return request.get(`/notifications?page=${page}`);
}

/* 获取某个通知的详情
*/
export async function getMailDetails(id) {
  return request.get(`/notifications/${id}`);
}
