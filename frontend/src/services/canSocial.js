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

// 回复某条评论（顶层评论或某条回复）：后端据此推导所属一级评论与展示用 reply_to。
export function replyToComment(replyToId, content) {
  return request.post('/comments/', { reply_to_id: replyToId, content });
}

// 拉取某条一级评论下的回复（二层平铺）。
export function listCommentReplies(parentId, params = {}) {
  return request.get('/comments/', { parent_id: parentId, ...params });
}

export function listNameplateComments(nameplateId, params = {}) {
  return request.get('/comments/', { nameplate_id: nameplateId, ...params });
}

export function createNameplateComment(nameplateId, content) {
  return request.post('/comments/', { nameplate_id: nameplateId, content });
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

export function listCanPosts(canId, params = {}) {
  return request.get('/posts/', { can_id: canId, ...params });
}

export function getCanPost(postId) {
  return request.get(`/posts/${postId}/`);
}

export function createCanPost(canId, text = '', visibility = 'public') {
  return request.post('/posts/', {
    can_id: Number(canId),
    text: String(text || '').trim(),
    visibility,
  });
}

export function deleteCanPost(postId) {
  return request.del(`/posts/${postId}/`);
}

export default {
  createCanComment,
  createNameplateComment,
  createCanPost,
  deleteCanComment,
  deleteCanPost,
  getCanPost,
  likeCan,
  likeCanComment,
  listCanComments,
  listCommentReplies,
  listNameplateComments,
  listCanPosts,
  replyToComment,
  unlikeCan,
  unlikeCanComment,
};
