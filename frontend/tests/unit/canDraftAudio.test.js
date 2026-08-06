import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isDraftAudioAvailable,
  persistDraftAudio,
  removeDraftAudio,
  restoreDraftAudio,
} from '@/services/canDraftAudio';

function createIndexedDbMock() {
  const values = new Map();
  const database = {
    objectStoreNames: { contains: vi.fn(() => false) },
    createObjectStore: vi.fn(),
    close: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: () => ({
        put(value, key) {
          const request = {};
          queueMicrotask(() => {
            values.set(key, value);
            request.result = key;
            request.onsuccess();
          });
          return request;
        },
        get(key) {
          const request = {};
          queueMicrotask(() => {
            request.result = values.get(key);
            request.onsuccess();
          });
          return request;
        },
        delete(key) {
          const request = {};
          queueMicrotask(() => {
            values.delete(key);
            request.onsuccess();
          });
          return request;
        },
      }),
    })),
  };
  return {
    open: vi.fn(() => {
      const request = { result: database };
      queueMicrotask(() => {
        request.onupgradeneeded();
        request.onsuccess();
      });
      return request;
    }),
  };
}

describe('can draft audio persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stores an H5 Blob in IndexedDB and recreates a usable object URL', async () => {
    globalThis.indexedDB = createIndexedDbMock();
    globalThis.uni = {
      getSystemInfoSync: vi.fn(() => ({ uniPlatform: 'web' })),
    };
    const objectUrl = vi.fn(() => 'blob:restored');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: objectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const blob = new Blob(['audio'], { type: 'audio/webm' });

    const persisted = await persistDraftAudio(
      { path: 'blob:temporary', blob, name: 'voice.webm', origin: 'record' },
      'audio-1',
    );
    const restored = await restoreDraftAudio(persisted);

    expect(persisted).toMatchObject({
      path: '',
      mediaId: 'audio-1',
      storage: 'indexeddb',
      persisted: true,
      available: true,
    });
    expect(restored.path).toBe('blob:restored');
    expect(objectUrl).toHaveBeenCalledWith(blob);

    await removeDraftAudio(restored);
    await expect(isDraftAudioAvailable(persisted)).resolves.toBe(false);
  });

  it('uses the persistent file API outside H5 and removes the saved file', async () => {
    globalThis.uni = {
      getSystemInfoSync: vi.fn(() => ({ uniPlatform: 'mp-weixin' })),
      saveFile: vi.fn(({ success }) => success({ savedFilePath: 'wxfile://saved.mp3' })),
      getSavedFileInfo: vi.fn(({ success }) => success({ size: 12 })),
      removeSavedFile: vi.fn(({ success }) => success({})),
    };

    const persisted = await persistDraftAudio(
      { path: 'wxfile://temp.mp3', name: 'voice.mp3', origin: 'record' },
      'audio-2',
    );

    expect(persisted).toMatchObject({
      path: 'wxfile://saved.mp3',
      storage: 'saved-file',
      persisted: true,
    });
    await expect(isDraftAudioAvailable(persisted)).resolves.toBe(true);
    await removeDraftAudio(persisted);
    expect(uni.removeSavedFile).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'wxfile://saved.mp3',
    }));
  });
});
