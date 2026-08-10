import request from '@/utils/request';

export function listDialects(params = {}) {
  return request.get('/dialects/', params);
}

function orderedDialects(items) {
  return [...items].sort((left, right) => (
    (left.sort_order || 0) - (right.sort_order || 0) || left.id - right.id
  ));
}

async function collectPages(fetcher, params = {}, page = 1, collected = []) {
  const response = await fetcher({ ...params, page, page_size: 100 });
  const results = collected.concat(response.results || response || []);
  return response.next
    ? collectPages(fetcher, params, page + 1, results)
    : results;
}

export async function listAllDialects() {
  const roots = orderedDialects(await collectPages(listDialects));
  const flattened = [];
  function appendBranch(items, depth) {
    return items.reduce(async (previous, item) => {
      await previous;
      const dialect = { ...item, depth };
      flattened.push(dialect);
      if (!dialect.children_count) return;
      const children = orderedDialects(await collectPages(listDialects, {
        parent_id: dialect.id,
      }));
      await appendBranch(children, depth + 1);
    }, Promise.resolve());
  }
  await appendBranch(roots, 0);
  return flattened;
}

export function resolveDialect(qualifiedCode) {
  return request.get('/dialects/resolve/', { qualified_code: qualifiedCode });
}

export function listCans(params = {}) {
  return request.get('/cans/', params);
}

export function getCan(id) {
  return request.get(`/cans/${id}/`);
}

export function createCanSubmission(payload) {
  return request.post('/cans/', payload);
}

export function listPackages(params = {}) {
  return request.get('/packages/', params);
}

export function listAllPackages() {
  return collectPages(listPackages);
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

export function listAllFlavors() {
  return collectPages(listFlavors);
}

export function getFlavor(id) {
  return request.get(`/flavors/${id}/`);
}

export function createFlavor(payload) {
  return request.post('/flavors/', payload);
}

export function listPronunciations(params = {}) {
  return request.get('/pronunciations/', params);
}

export function getPronunciation(id) {
  return request.get(`/pronunciations/${id}/`);
}

export function createPronunciation(payload) {
  return request.post('/pronunciations/', payload);
}

export function listShelves(params = {}) {
  return request.get('/shelves/', params);
}

export function getShelf(id) {
  return request.get(`/shelves/${id}/`);
}

export function createNameplate(canId, payload) {
  return request.post('/nameplates/', { ...payload, can_id: Number(canId) });
}

export function getNameplate(id) {
  return request.get(`/nameplates/${id}/`);
}

export function transitionCan(canId, action, reason = '') {
  return request.post(
    `/cans/${canId}/transition/`,
    { action, reason: String(reason || '').trim() },
    true,
  );
}

export function supportNameplate(nameplateId) {
  return request.put(`/nameplates/${nameplateId}/support/`);
}

export function unsupportNameplate(nameplateId) {
  return request.del(`/nameplates/${nameplateId}/support/`);
}

function normalizeCanPayload(can) {
  const payload = { ...can };
  if (!payload.submitted_dialect_id && payload.dialect) {
    payload.submitted_dialect_id = payload.dialect;
  }
  delete payload.dialect;
  delete payload.province;
  delete payload.city;
  delete payload.county;
  delete payload.town;
  return payload;
}

function hasNameplateClaim(label = {}) {
  return Boolean(
    String(label.text_content || '').trim()
    || String(label.pronunciation_text || '').trim()
    || label.package_id
    || label.flavor_id
    || label.dialect_id
    || label.pronunciation_id,
  );
}

export async function createCanWithNameplate({ can, label }) {
  const normalizedCan = normalizeCanPayload(can);
  const initialNameplate = hasNameplateClaim(label) ? {
    ...label,
    text_content: String(label.text_content || '').trim(),
    pronunciation_text: String(label.pronunciation_text || '').trim(),
    source: label.source || { type: 'creator' },
  } : undefined;
  return createCanSubmission({
    ...normalizedCan,
    initial_nameplate: initialNameplate,
  });
}

export async function createCanForFlavor({ can, flavorId }) {
  const normalizedCan = normalizeCanPayload(can);
  return createCanSubmission({
    ...normalizedCan,
    initial_nameplate: {
      flavor_id: Number(flavorId),
      dialect_id: normalizedCan.submitted_dialect_id,
      source: { type: 'creator' },
    },
  });
}

export async function searchGuantou(q, options = {}) {
  return request.get('/search/', { q, ...options }, true);
}

export async function suggestGuantou(q, options = {}) {
  return request.get('/search/suggest/', { q, ...options }, true);
}

export async function listHotSearches(options = {}) {
  return request.get('/search/hot/', options, true);
}
