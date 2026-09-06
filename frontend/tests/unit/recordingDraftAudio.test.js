import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistDraftAudio, restoreDraftAudio, isDraftAudioAvailable, removeDraftAudio } from '@/services/recordingDraftAudio';

function indexedDatabase({ abort = false } = {}) {
  const values = new Map();
  const db = {
    objectStoreNames: { contains: () => true }, close: vi.fn(),
    transaction() {
      const tx = { objectStore() {
        const operation = (kind, value, key) => {
          const request = {};
          queueMicrotask(() => {
            if (abort) { tx.onabort(); return; }
            if (kind === 'put') { values.set(key, value); request.result = key; }
            else if (kind === 'get') request.result = values.get(value);
            else values.delete(value);
            tx.oncomplete();
          });
          return request;
        };
        return { put: (value, key) => operation('put', value, key), get: (key) => operation('get', key), delete: (key) => operation('delete', key) };
      } };
      return tx;
    },
  };
  return { open: () => { const request = { result: db }; queueMicrotask(() => request.onsuccess()); return request; } };
}
beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.uni = { getSystemInfoSync: () => ({ uniPlatform: 'web' }) };
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:restored') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
describe('durable audio storage adapted from v1', () => {
  it('round-trips a Blob and releases persistent audio on deletion', async () => {
    globalThis.indexedDB = indexedDatabase();
    const audio = await persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'user:1:a');
    expect((await restoreDraftAudio(audio)).path).toBe('blob:restored');
    await removeDraftAudio(audio);
    expect(await isDraftAudioAvailable(audio)).toBe(false);
    expect((await restoreDraftAudio(audio)).invalid).toBe(true);
  });
  it('rejects an aborted transaction rather than announcing successful persistence', async () => {
    globalThis.indexedDB = indexedDatabase({ abort: true });
    await expect(persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'a')).rejects.toThrow('事务失败');
  });
  it('saves and reuses a mini-program persistent file', async () => {
    globalThis.uni = {
      getSystemInfoSync: () => ({ uniPlatform: 'mp-weixin' }),
      saveFile: vi.fn(({ success }) => success({ savedFilePath: 'wxfile://saved' })),
      getSavedFileInfo: vi.fn(({ success }) => success({ size: 10 })),
      removeSavedFile: vi.fn(({ success }) => success({})),
    };
    const saved = await persistDraftAudio({ path: 'wxfile://temp' }, 'a');
    expect((await restoreDraftAudio(saved)).path).toBe('wxfile://saved');
    await persistDraftAudio(saved, 'a');
    expect(uni.saveFile).toHaveBeenCalledTimes(1);
    await removeDraftAudio(saved);
    expect(uni.removeSavedFile).toHaveBeenCalled();
  });
});
