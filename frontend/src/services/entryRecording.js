import request from '@/utils/request';

export function pageResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function listEntries(params = {}) {
  return request.get('/entries/', params, true);
}

export function getEntry(id) {
  return request.get(`/entries/${id}/`, {}, true);
}

export function listRecordings(params = {}) {
  return request.get('/recordings/', params, true);
}

export function getRecording(id) {
  return request.get(`/recordings/${id}/`, {}, true);
}

export function createRecording(payload) {
  return request.post('/recordings/', payload);
}

export function createUsageAttestation(entryId, dialectId, note = '') {
  return request.post('/usage-attestations/', {
    entry_id: Number(entryId),
    dialect_id: Number(dialectId),
    note: String(note || '').trim(),
  });
}

export function getCurationSummary() {
  return request.get('/curation/', {}, true);
}

export function primaryEntryLink(recording = {}) {
  const links = (recording.entry_links || []).filter((link) => (
    link.is_current !== false && link.status !== 'rejected'
  ));
  return links.find((link) => link.role === 'primary') || links[0] || null;
}

export function entryTitle(entry = {}) {
  return String(entry.display_writing || entry.summary || '待整理词条').trim();
}

export function dialectLabel(dialect = {}) {
  return String(dialect.name || '地区待补充').trim();
}

export function buildEntrySearchParams(filters = {}) {
  const params = {};
  const values = {
    search: filters.keyword,
    dialect_id: filters.dialectId,
    dialect_match: filters.dialectMatch,
    writing_type: filters.writingType,
    source_type: filters.sourceType,
    status: filters.status,
    ipa: filters.ipa,
    romanization: filters.romanization,
    source: filters.source,
    concept: filters.concept,
    has_recording: filters.hasRecording,
    ordering: filters.ordering,
    page: filters.page,
    page_size: filters.pageSize,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
}

export default {
  buildEntrySearchParams,
  createRecording,
  createUsageAttestation,
  dialectLabel,
  entryTitle,
  getCurationSummary,
  getEntry,
  getRecording,
  listEntries,
  listRecordings,
  pageResults,
  primaryEntryLink,
};
