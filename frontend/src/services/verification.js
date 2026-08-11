import request from '@/utils/request';

export async function sendEmailCode(email, purpose = 'register') {
  return request.post('/users/email-code', { email, purpose });
}

export default {
  sendEmailCode,
};
