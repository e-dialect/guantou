import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({ listPackages: vi.fn() }));

const { packageListParams } = await import('@/pages/packages/index.vue');

describe('package index', () => {
  it('builds standard pagination filters without empty query values', () => {
    expect(packageListParams(' 行 ', 'orthodox', 3)).toEqual({
      page: 3,
      search: '行',
      package_type: 'orthodox',
    });
    expect(packageListParams('', '', 1)).toEqual({ page: 1 });
  });
});
