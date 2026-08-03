import request from '@/utils/request';

export function listDialects(params = {}) {
  return request.get('/dialects/', params);
}

export function listCans(params = {}) {
  return request.get('/cans/', params);
}

export function getCan(id) {
  return request.get(`/cans/${id}/`);
}

export function createCan(can) {
  return request.post('/cans/', can);
}

export function createCanSubmission(payload) {
  return request.post('/cans/', payload);
}

export function listPackages(params = {}) {
  return request.get('/packages/', params);
}

export function getPackage(id) {
  return request.get(`/packages/${id}/`);
}

export function createPackage(payload) {
  return request.post('/packages/', payload);
}

export function listFlavors(params = {}) {
  return request.get('/flavors/', params);
}

export function getFlavor(id) {
  return request.get(`/flavors/${id}/`);
}

export function createFlavor(payload) {
  return request.post('/flavors/', payload);
}

export function createFlavorVariant(payload) {
  return request.post('/flavor-variants/', payload);
}

export function listShelves(params = {}) {
  return request.get('/shelves/', params);
}

export function getShelf(id) {
  return request.get(`/shelves/${id}/`);
}

export function createNameplate(canId, payload) {
  return request.post(`/cans/${canId}/nameplates/`, payload);
}

export function voteNameplate(nameplateId, delta = 1) {
  return request.post(`/nameplates/${nameplateId}/vote/`, { delta });
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

export async function searchGuantou(search, options = {}) {
  return request.get('/search/', { search, ...options });
}
