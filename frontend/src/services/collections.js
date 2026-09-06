import request from '@/utils/request';

const quiet = {
  loading: false,
};
export const listCollections = (params = {}) => request.get('/collections/', params, true, quiet);
export const getCollection = (id) => request.get(`/collections/${id}/`, {}, true, quiet);
export const createCollection = (data) => request.post('/collections/', data);
export const updateCollection = (id, data) => request.patch(`/collections/${id}/`, data);
export const deleteCollection = (id) => request.del(`/collections/${id}/`);
export const addCollectionEntry = (id, entryId) => request.post(`/collections/${id}/entries/`, {
  entry_id: entryId,
});
export const addCollectionRecording = (id, recordingId, entryId = null) => request.post(`/collections/${id}/recordings/`, {
  recording_id: recordingId,
  entry_id: entryId,
});
export const removeCollectionItem = (id, kind, itemId) => request.del(`/collections/${id}/${kind}/${itemId}/`);
export const orderCollection = (id, ids, sectionId) => request.post(`/collections/${id}/order/`, {
  ids,
  ...(sectionId !== undefined ? {
    section_id: sectionId,
  } : {}),
});
