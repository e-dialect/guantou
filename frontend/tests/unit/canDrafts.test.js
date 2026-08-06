import { beforeEach, describe, expect, it, vi } from 'vitest';

const canDrafts = await import('@/services/canDrafts');

let storage;

function installUniMock() {
  storage = {};
  global.uni = {
    getStorageSync: vi.fn((key) => storage[key] || ''),
    setStorageSync: vi.fn((key, value) => {
      storage[key] = value;
    }),
    removeStorageSync: vi.fn((key) => {
      delete storage[key];
    }),
  };
}

describe('canDrafts', () => {
  beforeEach(() => {
    installUniMock();
  });

  it('saves and restores a can draft', () => {
    const draft = canDrafts.saveCanDraft(
      { concept_text: 'knee', dialect: 1 },
      { text_content: 'khnee' },
      {
        id: 'draft-1',
        mode: 'free',
        dialectName: '游洋话',
        audio: { path: '/tmp/a.mp3', origin: 'record' },
      },
    );

    expect(draft.id).toBe('draft-1');
    expect(canDrafts.getCanDraft('draft-1')).toMatchObject({
      id: 'draft-1',
      dialectName: '游洋话',
      form: { concept_text: 'knee', dialect: 1 },
      label: { text_content: 'khnee' },
      audio: { path: '/tmp/a.mp3', origin: 'record' },
    });
  });

  it('replaces an existing draft by id without changing its creation time', () => {
    const first = canDrafts.saveCanDraft(
      { concept_text: 'first' },
      {},
      { id: 'draft-1', createdAt: 100 },
    );
    canDrafts.saveCanDraft({ concept_text: 'second' }, {}, { id: 'draft-1' });

    const drafts = canDrafts.listCanDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].form.concept_text).toBe('second');
    expect(drafts[0].createdAt).toBe(first.createdAt);
  });

  it('removes a draft', () => {
    canDrafts.saveCanDraft({ concept_text: 'first' }, {}, { id: 'draft-1' });
    canDrafts.removeCanDraft('draft-1');

    expect(canDrafts.getCanDraft('draft-1')).toBeNull();
  });

  it('recovers safely from malformed storage', () => {
    storage.can_drafts = '{not json';

    expect(canDrafts.listCanDrafts()).toEqual([]);
    expect(uni.removeStorageSync).toHaveBeenCalledWith('can_drafts');
  });
});
