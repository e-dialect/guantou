import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  supportNameplate: vi.fn(),
  unsupportNameplate: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

import NameplateVoteRow from '@/components/home/NameplateVoteRow.vue';
import { supportNameplate, unsupportNameplate } from '@/services/guantou';
import { requireAuth } from '@/services/authGuard';

function setupUni(token = 'token-value') {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => (key === 'token' ? token : '')),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
  globalThis.getCurrentPages = vi.fn(() => []);
}

function mountRow(overrides = {}, extraProps = {}) {
  return mount(NameplateVoteRow, {
    props: {
      nameplate: {
        id: 7,
        display_text: '巴适',
        definition: '舒服',
        support_count: 3,
        supported_by_current_user: false,
        ...overrides,
      },
      ...extraProps,
    },
  });
}

describe('NameplateVoteRow optimistic voting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupUni();
  });

  it('supports optimistically, then adopts the server counts', async () => {
    let resolveSupport;
    supportNameplate.mockImplementation(
      () => new Promise((resolve) => {
        resolveSupport = resolve;
      }),
    );
    const wrapper = mountRow();

    await wrapper.find('.vote-row__support').trigger('tap');

    // 乐观更新：请求返回前本地票数已经 +1
    expect(wrapper.vm.supportCount).toBe(4);
    expect(wrapper.vm.supported).toBe(true);
    expect(wrapper.text()).toContain('已支持');

    resolveSupport({ support_count: 10, supported_by_current_user: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(supportNameplate).toHaveBeenCalledWith(7);
    expect(wrapper.vm.supportCount).toBe(10);
    expect(wrapper.emitted('support')).toBeTruthy();
  });

  it('rolls back when the support request fails', async () => {
    supportNameplate.mockRejectedValue(new Error('boom'));
    const wrapper = mountRow();

    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.supported).toBe(false);
    expect(wrapper.vm.supportCount).toBe(3);
    expect(wrapper.emitted('support')).toBeFalsy();
  });

  it('unsupports with an optimistic decrement', async () => {
    unsupportNameplate.mockResolvedValue({});
    const wrapper = mountRow({ supported_by_current_user: true, support_count: 6 });

    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(unsupportNameplate).toHaveBeenCalledWith(7);
    expect(wrapper.vm.supported).toBe(false);
    expect(wrapper.vm.supportCount).toBe(5);
    expect(wrapper.emitted('unsupport')).toBeTruthy();
  });

  it('keeps a busy lock to avoid double voting', async () => {
    let resolveSupport;
    supportNameplate.mockImplementation(
      () => new Promise((resolve) => {
        resolveSupport = resolve;
      }),
    );
    const wrapper = mountRow();

    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.find('.vote-row__support').trigger('tap');

    expect(supportNameplate).toHaveBeenCalledTimes(1);
    resolveSupport({ support_count: 4, supported_by_current_user: true });
    await wrapper.vm.$nextTick();
  });

  it('passes canId into the auth journey context when support requires login', async () => {
    requireAuth.mockReturnValue(true);
    supportNameplate.mockResolvedValue({});
    const wrapper = mountRow({}, { canId: 33 });

    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(requireAuth).toHaveBeenCalledWith('nameplate_support', {
      nameplateId: 7,
      canId: 33,
    });
    expect(supportNameplate).toHaveBeenCalledWith(7);
  });

  it('stops when the auth guard intercepts (guest support)', async () => {
    requireAuth.mockReturnValue(false);
    const wrapper = mountRow({}, { canId: 33 });

    await wrapper.find('.vote-row__support').trigger('tap');
    await wrapper.vm.$nextTick();

    expect(requireAuth).toHaveBeenCalledWith('nameplate_support', {
      nameplateId: 7,
      canId: 33,
    });
    expect(supportNameplate).not.toHaveBeenCalled();
    expect(wrapper.vm.supported).toBe(false);
    expect(wrapper.vm.supportCount).toBe(3);
  });

  it('routes the body, comments and debate as separate nameplate actions', async () => {
    requireAuth.mockReturnValue(true);
    const wrapper = mountRow({}, { canId: 33 });

    await wrapper.find('.plate-card__body').trigger('tap');
    await wrapper.find('.plate-card__comment').trigger('tap');
    await wrapper.find('.plate-card__action--debate').trigger('tap');

    expect(uni.navigateTo).toHaveBeenNthCalledWith(1, {
      url: '/pages/nameplates/details?id=7',
    });
    expect(uni.navigateTo).toHaveBeenNthCalledWith(2, {
      url: '/pages/nameplates/comments?id=7',
    });
    expect(uni.navigateTo).toHaveBeenNthCalledWith(3, {
      url: '/pages/nameplates/create?can_id=33&reference_id=7',
    });
  });
});
