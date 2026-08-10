import rawRequest from '@/utils/rawRequest';
import { afterLogin } from '@/services/login';

export const PHONE_PATTERN = /^1\d{10}$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]+/g, '').trim();
}

export function isValidPhone(phone) {
  return PHONE_PATTERN.test(normalizePhone(phone));
}

export function requestPhoneCode(phone) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    return Promise.reject(validationError('请输入有效的 11 位手机号'));
  }
  return rawRequest.post('/users/phone-code', {
    phone: normalized,
  }, { auth: false });
}

export async function loginWithPhone(phone, code) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    throw validationError('请输入有效的 11 位手机号');
  }
  if (!String(code || '').trim()) {
    throw validationError('请输入验证码');
  }
  const response = await rawRequest.post('/login/phone', {
    phone: normalized,
    code: String(code).trim(),
  }, { auth: false });
  await afterLogin(response, { isNew: Boolean(response.is_new) });
  return response;
}
