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

export function listPackages(params = {}) {
  return request.get('/api/packages/', params);
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
  const createdCan = await createCan(can);
  const labelText = (label.text_content || '').trim();
  if (!labelText) {
    return createdCan;
  }

  const createdPackage = await createPackage({
    text: labelText,
    package_type: label.package_type || 'uncertain',
  });
  const createdFlavor = await createFlavor({
    name: label.definition || can.concept_text || labelText,
    definition: label.definition || can.concept_text || labelText,
    mandarin: can.concept_text ? [can.concept_text] : [],
    package_ids: [createdPackage.id],
  });
  await createNameplate(createdCan.id, {
    flavor: createdFlavor.id,
    package: createdPackage.id,
    text_content: labelText,
    definition: label.definition || can.concept_text || '',
    evidence_level: label.evidence_level || 1,
    source_citation: label.source_citation || '',
  });
  return getCan(createdCan.id);
}
