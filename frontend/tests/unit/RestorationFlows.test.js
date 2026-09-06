import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/recordingDrafts', () => ({ draftOwner: vi.fn(() => 'user:1'), saveRecordingDraft: vi.fn(), restoreRecordingDraft: vi.fn(), deleteRecordingDraft: vi.fn() }));
vi.mock('@/services/collections', () => ({ listCollections: vi.fn(), createCollection: vi.fn(), addCollectionEntry: vi.fn(), addCollectionRecording: vi.fn(), getCollection: vi.fn(), updateCollection: vi.fn(), deleteCollection: vi.fn(), removeCollectionItem: vi.fn(), orderCollection: vi.fn() }));
vi.mock('@/services/entrySearchAssist', () => ({ suggestEntries: vi.fn(), popularEntries: vi.fn(), searchHistory: vi.fn(() => []), rememberSearch: vi.fn(), clearSearchHistory: vi.fn() }));
vi.mock('@/services/recordingSocial', () => ({ likeRecording: vi.fn(), listComments: vi.fn(), createComment: vi.fn(), deleteComment: vi.fn(), likeComment: vi.fn(), commentRequestId: vi.fn(() => 'same-request') }));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), confirm: vi.fn(async () => true) }));
import RecordingCreate from '@/pages/recordings/create.vue';
import { saveRecordingDraft } from '@/services/recordingDrafts';
import Picker from '@/components/CollectionPicker.vue';
import Search from '@/pages/search.vue';
import Detail from '@/pages/recordings/details.vue';
import { addCollectionEntry, addCollectionRecording } from '@/services/collections';
import { suggestEntries } from '@/services/entrySearchAssist';
import { createComment, listComments } from '@/services/recordingSocial';
const context = (component, extra = {}) => ({ ...component.data(), ...component.methods, ...extra });
beforeEach(() => { vi.clearAllMocks(); });
describe('restored journeys', () => {
  it('keeps a mini-program recording submit-ready after saving moves its temporary file', async () => {
    saveRecordingDraft.mockResolvedValue({ id: 'draft-a', audio: { path: 'wxfile://saved', persisted: true, mediaId: 'a' } });
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://temporary' } });
    await page.saveDraft();
    expect(page.audio.path).toBe('wxfile://saved');
    expect(page.draftId).toBe('draft-a');
  });
  it('collects just an entry without automatically collecting all of its recordings', async () => {
    const picker = context(Picker, { entryId: 9, recording: null });
    await picker.collect(1);
    expect(addCollectionEntry).toHaveBeenCalledWith(1, 9);
    expect(addCollectionRecording).not.toHaveBeenCalled();
  });
  it('uses the chosen entry only as collection placement', async () => {
    const picker = context(Picker, { recording: { id: 5 }, selectedEntry: 7 });
    await picker.collect(1);
    expect(addCollectionRecording).toHaveBeenCalledWith(1, 5, 7);
    expect(addCollectionEntry).not.toHaveBeenCalled();
  });
  it('ignores a late suggestion response after the user changes the query', async () => {
    vi.useFakeTimers();
    let resolveFirst;
    suggestEntries.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; })).mockResolvedValueOnce([{ id: 2 }]);
    const search = context(Search);
    Search.watch['filters.keyword'].call(search, '月');
    await vi.advanceTimersByTimeAsync(250);
    Search.watch['filters.keyword'].call(search, '雨');
    await vi.advanceTimersByTimeAsync(250);
    resolveFirst([{ id: 1 }]); await Promise.resolve();
    expect(search.suggestions).toEqual([{ id: 2 }]);
    vi.useRealTimers();
  });
  it('retains a comment request id after a failed send to prevent duplicate comments', async () => {
    const detail = context(Detail, { id: 5, form: { body: '乡音' }, $refs: { commentForm: { validate: async () => true } } });
    createComment.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 1 });
    listComments.mockResolvedValue({ results: [], next: null });
    await detail.send(); expect(detail.form.body).toBe('乡音');
    await detail.send();
    expect(createComment.mock.calls[0][0].client_id).toBe(createComment.mock.calls[1][0].client_id);
    expect(detail.form.body).toBe('');
  });
});
