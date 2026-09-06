import { persistDraftAudio, restoreDraftAudio, removeDraftAudio } from './recordingDraftAudio';

export function draftOwner() {
  const id = uni.getStorageSync('id');
  return id !== '' && id !== null && id !== undefined ? `user:${id}` : 'guest';
}
const key = (owner) => `recording_drafts:v2:${owner}`;
export function listRecordingDrafts(owner = draftOwner()) {
  try {
    const items = JSON.parse(uni.getStorageSync(key(owner)) || '[]');
    return Array.isArray(items) ? items.filter((item) => item.owner === owner) : [];
  } catch (error) {
    return [];
  }
}
export async function saveRecordingDraft({
  id,
  form,
  audio,
  entryId,
}, owner = draftOwner()) {
  if (owner === 'guest') throw new Error('请先登录后保存草稿');
  const draftId = id || `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const old = listRecordingDrafts(owner).find((item) => item.id === draftId);
  let storedAudio = null;
  let audioError = false;
  try {
    storedAudio = await persistDraftAudio(audio, `${owner}:${draftId}:${Date.now()}`);
  } catch (error) {
    if (old?.audio) throw new Error('音频保存失败，原草稿已保留，请保留本页重试');
    audioError = true;
  }
  const item = {
    id: draftId,
    owner,
    form: {
      ...form,
    },
    entryId,
    audio: storedAudio,
    audioError,
    updatedAt: Date.now(),
  };
  // Re-read after async audio persistence so another draft's save is not overwritten.
  const items = listRecordingDrafts(owner).filter((draft) => draft.id !== draftId);
  try {
    uni.setStorageSync(key(owner), JSON.stringify([item, ...items]));
  } catch (error) {
    // saveFile moves the temporary file. Keep its new path available for retry.
    if (storedAudio?.storage === 'saved-file') {
      const failure = new Error('草稿空间不足，请保留本页并重试');
      failure.persistedAudio = storedAudio;
      throw failure;
    }
    if (storedAudio?.mediaId !== old?.audio?.mediaId) await removeDraftAudio(storedAudio);
    throw new Error('草稿空间不足，请保留本页并重试');
  }
  if (old?.audio && old.audio.mediaId !== storedAudio?.mediaId) await removeDraftAudio(old.audio);
  return item;
}
export async function restoreRecordingDraft(id, owner = draftOwner()) {
  const item = listRecordingDrafts(owner).find((draft) => draft.id === id);
  if (!item) throw new Error('草稿不存在或属于其他账号');
  return {
    ...item,
    audio: await restoreDraftAudio(item.audio),
  };
}
export async function deleteRecordingDraft(id, owner = draftOwner()) {
  const items = listRecordingDrafts(owner);
  const item = items.find((draft) => draft.id === id);
  uni.setStorageSync(key(owner), JSON.stringify(items.filter((draft) => draft.id !== id)));
  await removeDraftAudio(item?.audio);
}
