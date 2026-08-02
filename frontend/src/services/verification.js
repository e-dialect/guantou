import request from '@/utils/request';

export async function sendEmailCode(email) {
  return request.post('/users/email-code', { email });
}

export default {
  sendEmailCode,
};
