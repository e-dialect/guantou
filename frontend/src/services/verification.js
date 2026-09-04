import request from '@/utils/request';

export async function sendEmailCode(email, purpose = 'register', silent = false) {
  return request.post('/users/email-code', { email, purpose }, silent);
}

export default {
  sendEmailCode,
};
