import {
  isDraftAudioAvailable,
  persistDraftAudio,
  removeDraftAudio,
  restoreDraftAudio,
} from '@/services/canDraftAudio';

const LEGACY_STORAGE_KEY = 'can_drafts';
const STORAGE_PREFIX = 'can_drafts:';
const ANONYMOUS_SESSION_KEY = 'can_drafts_anonymous_session';

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCanDraftId() {
  return createId('draft');
}

export function getCanDraftOwnerScope() {
  const userId = uni.getStorageSync('id');
  if (userId !== '' && userId !== null && userId !== undefined) return `user:${userId}`;
  let anonymousId = uni.getStorageSync(ANONYMOUS_SESSION_KEY);
  if (!anonymousId) {
    anonymousId = createId('anonymous');
    uni.setStorageSync(ANONYMOUS_SESSION_KEY, anonymousId);
  }
  return `anonymous:${anonymousId}`;
}

function storageKey(ownerScope) {
  return `${STORAGE_PREFIX}${ownerScope}`;
}

function normalizeDraft(draft, ownerScope) {
  if (!draft || typeof draft !== 'object') return null;
  const audio = draft.audio
    ? {
      ...draft.audio,
      available: draft.audio.persisted ? draft.audio.available !== false : false,
      invalid: !draft.audio.persisted,
    }
    : null;
  return {
    ...draft,
    ownerScope: draft.ownerScope || ownerScope,
    audio,
  };
}

function parseDrafts(raw, key, ownerScope) {
  try {
    const drafts = JSON.parse(raw || '[]');
    if (!Array.isArray(drafts)) return [];
    return drafts.map((draft) => normalizeDraft(draft, ownerScope)).filter(Boolean);
  } catch (error) {
    uni.removeStorageSync(key);
    return [];
  }
}

function migrateLegacyDrafts(ownerScope) {
  const legacy = uni.getStorageSync(LEGACY_STORAGE_KEY);
  if (!legacy) return;
  const key = storageKey(ownerScope);
  const existing = parseDrafts(uni.getStorageSync(key), key, ownerScope);
  const migrated = parseDrafts(legacy, LEGACY_STORAGE_KEY, ownerScope);
  const merged = [...existing, ...migrated]
    .filter((draft, index, drafts) => drafts.findIndex((item) => item.id === draft.id) === index)
    .slice(0, 20);
  uni.setStorageSync(key, JSON.stringify(merged));
  uni.removeStorageSync(LEGACY_STORAGE_KEY);
}

export function createDraftPayload(form, label, meta = {}) {
  return {
    id: meta.id || createCanDraftId(),
    ownerScope: meta.ownerScope || getCanDraftOwnerScope(),
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

export function listCanDrafts(ownerScope = getCanDraftOwnerScope()) {
  migrateLegacyDrafts(ownerScope);
  const key = storageKey(ownerScope);
  return parseDrafts(uni.getStorageSync(key), key, ownerScope)
    .filter((draft) => draft.ownerScope === ownerScope);
}

export async function saveCanDraft(form, label, meta = {}) {
  const ownerScope = meta.ownerScope || getCanDraftOwnerScope();
  const storedDrafts = listCanDrafts(ownerScope);
  const existing = meta.id
    ? storedDrafts.find((item) => item.id === meta.id)
    : null;
  const id = meta.id || createCanDraftId();
  let audio = null;
  if (meta.audio && meta.audio.path) {
    try {
      audio = await persistDraftAudio(meta.audio, `can-draft-audio:${id}`);
    } catch (error) {
      audio = {
        name: meta.audio.name || '',
        durationMs: meta.audio.durationMs || 0,
        origin: meta.audio.origin || '',
        path: '',
        persisted: false,
        available: false,
        invalid: true,
      };
    }
  } else if (meta.audio?.invalid) {
    audio = {
      name: meta.audio.name || '',
      durationMs: meta.audio.durationMs || 0,
      origin: meta.audio.origin || '',
      path: '',
      persisted: false,
      available: false,
      invalid: true,
    };
  }
  if (
    existing?.audio
    && (
      !audio
      || existing.audio.mediaId !== audio.mediaId
      || existing.audio.storage !== audio.storage
      || existing.audio.path !== audio.path
    )
  ) {
    await removeDraftAudio(existing.audio);
  }
  const draft = createDraftPayload(form, label, {
    ...meta,
    id,
    ownerScope,
    audio,
    createdAt: meta.createdAt || (existing && existing.createdAt),
  });
  const drafts = storedDrafts.filter((item) => item.id !== draft.id);
  const retainedDrafts = [draft, ...drafts].slice(0, 20);
  const evictedDrafts = [draft, ...drafts].slice(20);
  uni.setStorageSync(storageKey(ownerScope), JSON.stringify(retainedDrafts));
  await Promise.all(evictedDrafts.map((item) => removeDraftAudio(item.audio)));
  return draft;
}

export function getCanDraft(id, ownerScope = getCanDraftOwnerScope()) {
  return listCanDrafts(ownerScope).find((item) => item.id === id) || null;
}

export async function getCanDraftWithAudio(id, ownerScope = getCanDraftOwnerScope()) {
  const draft = getCanDraft(id, ownerScope);
  if (!draft || !draft.audio) return draft;
  return {
    ...draft,
    audio: await restoreDraftAudio(draft.audio),
  };
}

export async function listCanDraftsWithAudioStatus(ownerScope = getCanDraftOwnerScope()) {
  const drafts = listCanDrafts(ownerScope);
  return Promise.all(drafts.map(async (draft) => ({
    ...draft,
    audio: draft.audio
      ? { ...draft.audio, available: await isDraftAudioAvailable(draft.audio) }
      : null,
  })));
}

export async function removeCanDraft(id, ownerScope = getCanDraftOwnerScope()) {
  const drafts = listCanDrafts(ownerScope);
  const removed = drafts.find((item) => item.id === id);
  uni.setStorageSync(
    storageKey(ownerScope),
    JSON.stringify(drafts.filter((item) => item.id !== id)),
  );
  if (removed?.audio) await removeDraftAudio(removed.audio);
}

export async function claimAnonymousCanDrafts(userId, anonymousScope) {
  if (!userId || !anonymousScope || !anonymousScope.startsWith('anonymous:')) return [];
  const targetScope = `user:${userId}`;
  const anonymousDrafts = listCanDrafts(anonymousScope);
  const userDrafts = listCanDrafts(targetScope);
  const claimedDrafts = anonymousDrafts.map((draft) => ({
    ...draft,
    ownerScope: targetScope,
  }));
  const allDrafts = [...claimedDrafts, ...userDrafts]
    .filter((draft, index, drafts) => drafts.findIndex((item) => item.id === draft.id) === index)
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  const merged = allDrafts.slice(0, 20);
  const evictedDrafts = allDrafts.slice(20);
  uni.setStorageSync(storageKey(targetScope), JSON.stringify(merged));
  uni.removeStorageSync(storageKey(anonymousScope));
  await Promise.all(evictedDrafts.map((draft) => removeDraftAudio(draft.audio)));
  return merged;
}

export default {
  createDraftPayload,
  createCanDraftId,
  claimAnonymousCanDrafts,
  getCanDraft,
  getCanDraftOwnerScope,
  getCanDraftWithAudio,
  listCanDrafts,
  listCanDraftsWithAudioStatus,
  removeCanDraft,
  saveCanDraft,
};
