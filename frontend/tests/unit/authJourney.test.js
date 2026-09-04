import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  saveInterceptIntent: vi.fn(),
}));

import { toLoginPage } from '@/routers/login';
import { clearInterceptIntent, saveInterceptIntent } from '@/services/authGuard';
import {
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
} from '@/services/authJourney';

describe('auth journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { reLaunch: vi.fn() };
  });

  it('records voluntary mine login before opening the shared login page', () => {
    openLoginFromMine();

    expect(saveInterceptIntent).toHaveBeenCalledWith({
      action: 'open_mine',
      context: { page: 'mine' },
      voluntary: true,
    });
    expect(toLoginPage).toHaveBeenCalledTimes(1);
  });

  it('clears a cancelled intent and relaunches public search', () => {
    cancelLoginToSearch();

    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/search' });
  });

  it('rejects incomplete nameplate context', () => {
    expect(resolveAuthDestination({
      action: 'nameplate_create',
      context: {},
    })).toEqual({ kind: 'fallback' });
  });

  it('returns a dm intent to the mail send page with the recipient', () => {
    expect(resolveAuthDestination({
      action: 'dm',
      context: { page: 'user_detail', userId: 9 },
    })).toEqual({
      kind: 'url',
      route: 'pages/mails/send',
      url: '/pages/mails/send?id=9',
    });
  });

  it('rejects a dm intent without a recipient', () => {
    expect(resolveAuthDestination({
      action: 'dm',
      context: { page: 'user_detail' },
    })).toEqual({ kind: 'fallback' });
  });

  it('returns a follow intent to the user without performing the follow', () => {
    expect(resolveAuthDestination({
      action: 'follow',
      context: { page: 'user_detail', userId: 12 },
    })).toEqual({
      kind: 'url',
      route: 'pages/users/details',
      url: '/pages/users/details?id=12',
    });
  });

  it('returns a like intent to the can detail', () => {
    expect(resolveAuthDestination({
      action: 'like',
      context: { page: 'can_detail', canId: 19 },
    })).toEqual({
      kind: 'url',
      route: 'pages/cans/details',
      url: '/pages/cans/details?id=19',
    });
  });

  it('returns a comment intent to the can comment thread', () => {
    expect(resolveAuthDestination({
      action: 'comment',
      context: { page: 'can_detail', canId: 19 },
    })).toEqual({
      kind: 'url',
      route: 'pages/cans/comments',
      url: '/pages/cans/comments?id=19',
    });
  });

  it('returns a comment-like intent back to the comment thread, not can detail (#248)', () => {
    expect(resolveAuthDestination({
      action: 'comment_like',
      context: { page: 'can_comments', canId: 19 },
    })).toEqual({
      kind: 'url',
      route: 'pages/cans/comments',
      url: '/pages/cans/comments?id=19',
    });
  });

  it('returns a use-same intent directly to the locked composer', () => {
    expect(resolveAuthDestination({
      action: 'use_same',
      context: { page: 'post_detail', canId: 23, postId: 8 },
    })).toEqual({
      kind: 'url',
      route: 'pages/posts/compose',
      url: '/pages/posts/compose?can_id=23',
    });
  });

  it('returns circle membership and recording intents to their exact context', () => {
    expect(resolveAuthDestination({
      action: 'circle_join',
      context: { page: 'circle_detail', circleId: 6 },
    })).toEqual({
      kind: 'url',
      route: 'pages/circles/details',
      url: '/pages/circles/details?id=6',
    });
    expect(resolveAuthDestination({
      action: 'record_can',
      context: { page: 'circle_detail', dialectId: 8 },
    })).toEqual({
      kind: 'url',
      route: 'pages/cans/create',
      url: '/pages/cans/create?dialect=8',
    });
  });

  it('returns V2 recording and attestation intents to the Entry context', () => {
    expect(resolveAuthDestination({
      action: 'record_recording',
      context: { page: 'entry_detail', entryId: 27 },
    })).toEqual({
      kind: 'url',
      route: 'pages/recordings/create',
      url: '/pages/recordings/create?entry_id=27',
    });
    expect(resolveAuthDestination({
      action: 'attest_usage',
      context: { page: 'listen', entryId: 27 },
    })).toEqual({
      kind: 'url',
      route: 'pages/entries/details',
      url: '/pages/entries/details?id=27',
    });
  });
});
