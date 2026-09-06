import request from '@/utils/request';

export const likeRecording = (id, liked) => (liked ? request.put(`/recordings/${id}/like/`, {}) : request.del(`/recordings/${id}/like/`));
export const listComments = (recordingId, page = 1) => request.get('/recording-comments/', {
  recording_id: recordingId,
  page,
}, true, {
  loading: false,
});
export const createComment = (data) => request.post('/recording-comments/', data);
export const deleteComment = (id) => request.del(`/recording-comments/${id}/`);
export const likeComment = (id, liked) => (liked ? request.put(`/recording-comments/${id}/like/`, {}) : request.del(`/recording-comments/${id}/like/`));
export const discoverRecording = (kind = 'daily') => request.get(`/recordings/${kind}/`, {}, true, {
  loading: false,
});
export function commentRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value % 4) + 8).toString(16);
  });
}
