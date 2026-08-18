import {
  goLogin,
  goLoginForget,
  goLoginRegister,
  goLoginWechatRegister,
} from '@/services/navigation';

/**
 * 前往忘记密码页面
 */
export function toForgetPage() {
  goLoginForget();
}

/**
 * 前往登录页面
 */
export function toLoginPage() {
  goLogin();
}

/**
 * 前往微信注册页面
 */
export function toRegisterPage() {
  goLoginRegister();
}

/**
 * 前往微信注册页面
 */
export function toWechatRegisterPage() {
  goLoginWechatRegister();
}
