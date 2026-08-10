import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  createNameplate: vi.fn(),
  getCan: vi.fn(),
  listAllDialects: vi.fn(),
  listAllFlavors: vi.fn(),
  listAllPackages: vi.fn(),
  supportNameplate: vi.fn(),
  transitionCan: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/services/canSocial', () => ({
  createCanComment: vi.fn(),
  deleteCanComment: vi.fn(),
  likeCan: vi.fn(),
  listCanComments: vi.fn(),
  unlikeCan: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/utils/audio', () => ({ playAudio: vi.fn() }));
vi.mock('@/routers/user', () => ({ toUserPage: vi.fn() }));
vi.mock('@/utils/shareCan', () => ({
  canSharePayload: vi.fn(),
  shareCanOnWeb: vi.fn(),
}));

const { transitionCan } = await import('@/services/guantou');
const CanDetails = (await import('@/pages/cans/details.vue')).default;
const {
  availableCanTransitions,
} = await import('@/pages/cans/details.vue');

function pageContext(can, user = { id: 7, is_staff: false }) {
  const data = CanDetails.data();
  return {
    ...data,
    ...CanDetails.methods,
    can,
    currentUser: user,
  };
}

describe('can review flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn() };
  });

  it('shows only transitions allowed for the current role and state', () => {
    expect(availableCanTransitions(
      { status: 'pending', recorder: { id: 7 } },
      { id: 7, is_staff: false },
    ).map((item) => item.action)).toEqual(['submit']);
    expect(availableCanTransitions(
      { status: 'disputed', recorder: { id: 7 } },
      { id: 8, is_staff: true },
    ).map((item) => item.action)).toEqual(['verify', 'reject']);
    expect(availableCanTransitions(
      { status: 'tentative', recorder: { id: 7 } },
      { id: 8, is_staff: false },
    )).toEqual([]);
  });

  it('does not change page state when a transition fails', async () => {
    transitionCan.mockRejectedValue({ message: '状态已被其他审核人修改' });
    const original = { id: 9, status: 'tentative', recorder: { id: 7 } };
    const page = pageContext(original, { id: 8, is_staff: true });

    await page.runTransition('verify');

    expect(page.can).toBe(original);
    expect(page.can.status).toBe('tentative');
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '状态已被其他审核人修改',
      icon: 'none',
    });
  });
});
