import request from '@/utils/request';

export function listDialects(params = {}) {
  return request.get('/api/dialects/', params);
}

export function listCans(params = {}) {
  return request.get('/api/cans/', params);
}

export function getCan(id) {
  return request.get(`/api/cans/${id}/`);
}

export function createCan(can) {
  return request.post('/api/cans/', can);
}

export function createCanSubmission(payload) {
  return request.post('/api/cans/', payload);
}

export function listPackages(params = {}) {
  return request.get('/api/packages/', params);
}

export function getPackage(id) {
  return request.get(`/api/packages/${id}/`);
}

export function createPackage(payload) {
  return request.post('/api/packages/', payload);
}

export function listFlavors(params = {}) {
  return request.get('/api/flavors/', params);
}

export function getFlavor(id) {
  return request.get(`/api/flavors/${id}/`);
}

export function createFlavor(payload) {
  return request.post('/api/flavors/', payload);
}

export function createFlavorVariant(payload) {
  return request.post('/api/flavor-variants/', payload);
}

export function listShelves(params = {}) {
  return request.get('/api/shelves/', params);
}

export function getShelf(id) {
  return request.get(`/api/shelves/${id}/`);
}

export function createNameplate(canId, payload) {
  return request.post(`/api/cans/${canId}/nameplates/`, payload);
}

export function voteNameplate(nameplateId, delta = 1) {
  return request.post(`/api/nameplates/${nameplateId}/vote/`, { delta });
}

export async function createCanWithNameplate({ can, label }) {
  const labelText = (label.text_content || '').trim();
  return createCanSubmission({
    ...can,
    initial_nameplate: labelText ? {
      ...label,
      text_content: labelText,
    } : undefined,
  });
}

export async function createCanForFlavor({ can, flavorId }) {
  return createCanSubmission({
    ...can,
    flavor: flavorId,
  });
}

export async function searchGuantou(search) {
  return request.get('/api/search/', { search });
}
