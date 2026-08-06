const STORAGE_KEY = 'can_drafts';

export function createDraftPayload(form, label, meta = {}) {
  return {
    id: meta.id || `draft_${Date.now()}`,
    mode: meta.mode || 'free',
    targetFlavor: meta.targetFlavor || null,
    dialectName: meta.dialectName || '',
    form: { ...form },
    label: { ...label },
    audio: meta.audio || null,
    reason: meta.reason || '',
    createdAt: meta.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

export function listCanDrafts() {
  try {
    const drafts = JSON.parse(uni.getStorageSync(STORAGE_KEY) || '[]');
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    uni.removeStorageSync(STORAGE_KEY);
    return [];
  }
}

export function saveCanDraft(form, label, meta = {}) {
  const storedDrafts = listCanDrafts();
  const existing = meta.id
    ? storedDrafts.find((item) => item.id === meta.id)
    : null;
  const draft = createDraftPayload(form, label, {
    ...meta,
    createdAt: meta.createdAt || (existing && existing.createdAt),
  });
  const drafts = storedDrafts.filter((item) => item.id !== draft.id);
  uni.setStorageSync(STORAGE_KEY, JSON.stringify([draft, ...drafts].slice(0, 20)));
  return draft;
}

export function getCanDraft(id) {
  return listCanDrafts().find((item) => item.id === id) || null;
}

export function removeCanDraft(id) {
  uni.setStorageSync(
    STORAGE_KEY,
    JSON.stringify(listCanDrafts().filter((item) => item.id !== id)),
  );
}

export default {
  createDraftPayload,
  getCanDraft,
  listCanDrafts,
  removeCanDraft,
  saveCanDraft,
};
