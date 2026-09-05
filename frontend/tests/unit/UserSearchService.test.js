import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/utils/request', () => ({
  default: { get: mocks.get },
}));
vi.mock('@/utils/rawRequest', () => ({
  default: {},
}));
vi.mock('@/services/login', () => ({ afterLogin: vi.fn() }));
vi.mock('@/services/themeApi', () => ({ afterThemeLogout: vi.fn() }));

const { searchUsers } = await import('@/services/user');

describe('user recipient search service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes the query and returns the public user list', async () => {
    const users = [{ id: 12, username: 'lin-local', nickname: '阿林' }];
    mocks.get.mockResolvedValue({ users });

    await expect(searchUsers('  阿林  ', 8)).resolves.toEqual(users);
    expect(mocks.get).toHaveBeenCalledWith(
      '/users',
      { search: '阿林', limit: 8 },
      true,
      { loading: false },
    );
  });

  it('does not call the API for an empty query', async () => {
    await expect(searchUsers('   ')).resolves.toEqual([]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
