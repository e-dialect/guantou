import request from '@/utils/request';
import rawRequest from '@/utils/rawRequest';
import { afterLogin } from '@/services/login';

/**
 * US0101 新建用户（普通）
 * @returns {Promise<unknown>}
 */
export async function registerUser(username, password, email, code) {
  return new Promise((resolve, reject) => {
    rawRequest.post('/users', {
      username, password, email, code,
    }, { auth: false }).then((res) => {
      resolve(res);
    }).catch((err) => {
      switch (err.statusCode) {
        case 401:
          uni.showToast({
            title: err.message || '验证码错误',
            icon: 'error',
          });
          break;
        case 409:
          uni.showToast({
            title: err.message || '用户名已存在',
            icon: 'error',
          });
          break;
        default:
          uni.showToast({
            title: err.message || '注册失败',
            icon: 'error',
          });
      }
      reject(err);
    });
  });
}

/**
 * US0102 新建用户（微信）
 * @param username 用户名
 * @param password 密码
 * @param nickname 昵称
 */
export function registerWechatUser(username, password, nickname) {
  uni.login({
    async success(res) {
      if (res.code) {
        await rawRequest.post('/users/wechat/register', {
          username,
          password,
          jscode: res.code,
          nickname,
        }, { auth: false }).then(async (response) => {
          await afterLogin(response, { isNew: true });
        }).catch((err) => {
          switch (err.statusCode) {
            case 409:
              uni.showToast({
                title: err.message || '用户名已存在',
                icon: 'error',
              });
              break;
            default:
              uni.showToast({
                title: err.message || '注册失败',
                icon: 'error',
              });
          }
        });
      } else {
        uni.showToast({
          title: '当前平台不支持',
        });
      }
    },
  });
}

/**
 * US0201 获取指定用户信息
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function getUserInfo(id) {
  return request.get(`/users/${id}`);
}

/**
 * US0301 更新用户信息（除password和email外）
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function changeUserInfo(id, userInfo) {
  return new Promise((resolve) => {
    request.put(`/users/${id}`, { user: userInfo }).then((res) => {
      uni.setStorageSync('token', res.token);
      getApp().globalData.userInfo = userInfo;
      uni.showToast({
        title: '修改成功',
      });
      resolve(res);
    });
  });
}

/**
 * US0302 更新用户密码
 * @param id 用户id
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns {Promise<unknown>}
 */
export async function changeUserPassword(id, oldPassword, newPassword) {
  return request.put(`/users/${id}/password`, { oldpassword: oldPassword, newpassword: newPassword });
}

/**
 * US0303 更新用户邮箱
 * @param id 用户id
 * @param email 邮箱
 * @param code 验证码
 * @returns {Promise<unknown>}
 */
export async function changeUserEmail(id, email, code) {
  return request.put(`/users/${id}/email`, { email, code });
}

/**
 * US0304 绑定微信
 * @param id{number} 用户id
 * @param overwrite{boolean} 是否覆盖
 * @returns {Promise<unknown>}
 */
export async function bindingWechat(id, overwrite) {
  return new Promise((resolve, reject) => {
    uni.login({
      async success(res) {
        if (!res.code) {
          reject(new Error('获取账号失败'));
          return;
        }
        try {
          await request.put(`/users/${id}/wechat`, { jscode: res.code, overwrite });
          resolve({ success: true, message: '绑定成功' });
        } catch (err) {
          // 传递错误给调用方，由调用方统一显示提示
          reject(err instanceof Error ? err : new Error((err && (err.message || JSON.stringify(err))) || '绑定失败'));
        }
      },
      fail() {
        reject(new Error('获取账号失败'));
      },
    });
  });
}

/**
 * US0305 取消绑定微信
 * @param id 用户id
 * @returns {Promise<unknown>}
 */
export async function cancelBindingWechat(id) {
  return request.del(`/users/${id}/wechat`);
}

/**
 * 清理登录状态
 */
export function clearUserInfo() {
  uni.removeStorageSync('token');
  uni.removeStorageSync('id');
  uni.removeStorageSync('auth_intercept_intent');
  const app = getApp();
  delete app.globalData.userInfo;
  delete app.globalData.contribution;
  delete app.globalData.id;
}

/**
 * 通过用户名获取账号关联邮箱
 * @param username 用户名
 * @returns {Promise<unknown>}
 */
export function getEmailByUsername(username) {
  return rawRequest.get('/login/forget', { username }, { auth: false });
}

export function requestPasswordResetCode(username) {
  return rawRequest.post('/login/forget', { username }, { auth: false });
}

export function resetPassword(username, password, code) {
  return rawRequest.put('/login/forget', {
    username, password, code,
  }, { auth: false });
}
