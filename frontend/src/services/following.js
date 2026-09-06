import request from '@/utils/request';

const PAGE_LOAD_OPTIONS = Object.freeze({ loading: false });

export function listFollowRecommendations(dialectId, limit = 6) {
  return request.get('/users/recommendations', {
    dialect_id: dialectId,
    limit,
  }, false, PAGE_LOAD_OPTIONS);
}

export function followDialect(dialectId) {
  return request.put(`/dialects/${dialectId}/follow/`);
}

export function unfollowDialect(dialectId) {
  return request.del(`/dialects/${dialectId}/follow/`);
}

export function followUser(userId) {
  return request.put(`/users/${userId}/follow`);
}

export function unfollowUser(userId) {
  return request.del(`/users/${userId}/follow`);
}

export default {
  followDialect,
  followUser,
  listFollowRecommendations,
  unfollowDialect,
  unfollowUser,
};
