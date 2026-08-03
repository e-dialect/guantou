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

export async function createCanForFlavor({ can, flavorId }) {
  const variant = await createFlavorVariant({
    flavor: flavorId,
    dialect: can.dialect,
    audio_url: can.audio_url,
    audio_source: 'user',
  });
  const createdCan = await createCan({
    ...can,
    flavor_variant: variant.id,
  });
  return getCan(createdCan.id);
}
