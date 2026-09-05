import request from '@/utils/request';
import { registerDialectCatalog } from '@/utils/dialectTree';

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
  const items = await collectPages(listDialects, { flat: true });
  return registerDialectCatalog(orderedDialects(items));
}

export function resolveDialect(qualifiedCode) {
  return request.get('/dialects/resolve/', { qualified_code: qualifiedCode });
}

export function listCircles(params = {}) {
  return request.get('/circles/', params);
}

export function getCircle(id) {
  return request.get(`/circles/${id}/`);
}

export function joinCircle(id) {
  return request.post(`/circles/${id}/membership/`, {});
}

export function leaveCircle(id) {
  return request.del(`/circles/${id}/membership/`);
}

export function listCircleRecordings(id, params = {}) {
  return request.get(`/circles/${id}/recordings/`, params, true);
}
