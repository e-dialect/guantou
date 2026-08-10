import request from '@/utils/request';

export function likeCan(canId) {
  return request.put(`/cans/${canId}/like/`);
}

export function unlikeCan(canId) {
  return request.del(`/cans/${canId}/like/`);
}

export function listCanComments(canId, params = {}) {
  return request.get('/comments/', { can_id: canId, ...params });
}

export function createCanComment(canId, content) {
  return request.post('/comments/', { can_id: canId, content });
}

export function deleteCanComment(commentId) {
  return request.del(`/comments/${commentId}/`);
}

export function likeCanComment(commentId) {
  return request.put(`/comments/${commentId}/like/`);
}

export function unlikeCanComment(commentId) {
  return request.del(`/comments/${commentId}/like/`);
}

export default {
  createCanComment,
  deleteCanComment,
  likeCan,
  likeCanComment,
  listCanComments,
  unlikeCan,
  unlikeCanComment,
};
