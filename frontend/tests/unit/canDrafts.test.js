import { beforeEach, describe, expect, it, vi } from 'vitest';

const audioMocks = vi.hoisted(() => ({
  isDraftAudioAvailable: vi.fn(async () => true),
  persistDraftAudio: vi.fn(async (audio, mediaId) => ({
    path: '/saved/audio.mp3',
    name: audio.name || '',
    durationMs: audio.durationMs || 0,
    origin: audio.origin || '',
    mediaId,
    storage: 'saved-file',
    persisted: true,
    available: true,
  })),
  removeDraftAudio: vi.fn(async () => {}),
  restoreDraftAudio: vi.fn(async (audio) => ({ ...audio, available: true })),
}));

vi.mock('@/services/canDraftAudio', () => audioMocks);

const canDrafts = await import('@/services/canDrafts');

let storage;

function installUniMock(userId = '7') {
  storage = userId ? { id: userId } : {};
  global.uni = {
    getStorageSync: vi.fn((key) => storage[key] ?? ''),
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
    vi.clearAllMocks();
    installUniMock();
  });

  it('persists and restores audio for a user-scoped can draft', async () => {
    const draft = await canDrafts.saveCanDraft(
      { concept_text: 'knee', dialect: 1 },
      { text_content: 'khnee' },
      {
        id: 'draft-1',
        mode: 'free',
        dialectName: '游洋话',
        audio: { path: '/tmp/a.mp3', origin: 'record' },
      },
    );

    expect(audioMocks.persistDraftAudio).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/tmp/a.mp3' }),
      'can-draft-audio:draft-1',
    );
    expect(draft.ownerScope).toBe('user:7');
    expect(canDrafts.getCanDraft('draft-1')).toMatchObject({
      id: 'draft-1',
      ownerScope: 'user:7',
      dialectName: '游洋话',
      form: { concept_text: 'knee', dialect: 1 },
      label: { text_content: 'khnee' },
      audio: { persisted: true, available: true },
    });
  });

  it('replaces an existing draft by id without changing its creation time', async () => {
    const first = await canDrafts.saveCanDraft(
      { concept_text: 'first' },
      {},
      { id: 'draft-1', createdAt: 100 },
    );
    await canDrafts.saveCanDraft({ concept_text: 'second' }, {}, { id: 'draft-1' });

    const drafts = canDrafts.listCanDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].form.concept_text).toBe('second');
    expect(drafts[0].createdAt).toBe(first.createdAt);
  });

  it('isolates drafts between signed-in accounts', async () => {
    await canDrafts.saveCanDraft({ concept_text: 'first user' }, {}, { id: 'draft-1' });

    storage.id = '8';
    expect(canDrafts.listCanDrafts()).toEqual([]);

    await canDrafts.saveCanDraft({ concept_text: 'second user' }, {}, { id: 'draft-2' });
    expect(canDrafts.listCanDrafts().map((draft) => draft.id)).toEqual(['draft-2']);

    storage.id = '7';
    expect(canDrafts.listCanDrafts().map((draft) => draft.id)).toEqual(['draft-1']);
  });

  it('claims anonymous drafts for the account that completes login', async () => {
    installUniMock('');
    const anonymousScope = canDrafts.getCanDraftOwnerScope();
    await canDrafts.saveCanDraft({ concept_text: 'anonymous' }, {}, { id: 'draft-1' });

    storage.id = '7';
    await canDrafts.claimAnonymousCanDrafts('7', anonymousScope);

    expect(canDrafts.listCanDrafts()).toEqual([
      expect.objectContaining({ id: 'draft-1', ownerScope: 'user:7' }),
    ]);
    storage.id = '8';
    expect(canDrafts.listCanDrafts()).toEqual([]);
  });

  it('removes a draft and its persisted recording', async () => {
    await canDrafts.saveCanDraft(
      { concept_text: 'first' },
      {},
      { id: 'draft-1', audio: { path: '/tmp/a.mp3' } },
    );
    await canDrafts.removeCanDraft('draft-1');

    expect(canDrafts.getCanDraft('draft-1')).toBeNull();
    expect(audioMocks.removeDraftAudio).toHaveBeenCalledWith(
      expect.objectContaining({ persisted: true }),
    );
  });

  it('reports a missing persisted recording as unavailable', async () => {
    audioMocks.isDraftAudioAvailable.mockResolvedValueOnce(false);
    await canDrafts.saveCanDraft(
      { concept_text: 'first' },
      {},
      { id: 'draft-1', audio: { path: '/tmp/a.mp3' } },
    );

    const drafts = await canDrafts.listCanDraftsWithAudioStatus();

    expect(drafts[0].audio.available).toBe(false);
  });

  it('recovers safely from malformed scoped storage', () => {
    storage['can_drafts:user:7'] = '{not json';

    expect(canDrafts.listCanDrafts()).toEqual([]);
    expect(uni.removeStorageSync).toHaveBeenCalledWith('can_drafts:user:7');
  });
});
