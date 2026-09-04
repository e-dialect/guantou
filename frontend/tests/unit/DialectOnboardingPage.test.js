import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(),
}));

vi.mock('@/services/dialectOnboarding', () => ({
  loadDialectSample: vi.fn(),
  normalizeOnboardingReason: vi.fn((reason) => reason || 'missing_dialect'),
  ONBOARDING_REASONS: {
    MISSING_DIALECT: 'missing_dialect',
    NEW_USER: 'new_user',
  },
  saveDialectProfile: vi.fn(),
}));

vi.mock('@/services/login', () => ({
  resumeInterruptedPageAfterLogin: vi.fn(() => false),
}));

vi.mock('@/services/user', () => ({
  clearUserInfo: vi.fn(),
}));

vi.mock('@/routers/user', () => ({
  toFollowRecommendations: vi.fn(),
}));

vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
}));

globalThis.getApp = vi.fn(() => ({
  globalData: {
    userInfo: { id: 7, username: 'collector', nickname: '采集者', primary_dialect: null },
  },
}));

import { listAllDialects } from '@/services/guantou';
import { loadDialectSample, saveDialectProfile } from '@/services/dialectOnboarding';
import { resumeInterruptedPageAfterLogin } from '@/services/login';
import { toFollowRecommendations } from '@/routers/user';

const { default: DialectOnboardingPage } = await import('@/pages/users/onboarding.vue');

function mountPage() {
  return mount(DialectOnboardingPage, {
    global: {
      stubs: {
        PageShell: {
          template: '<main><slot /></main>',
        },
      },
    },
  });
}

describe('dialect onboarding page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn((key) => (key === 'id' ? 7 : '')),
      reLaunch: vi.fn(),
      showToast: vi.fn(),
    };
    listAllDialects.mockResolvedValue([
      { id: 3, name: '四川话', qualified_code: '西南官话.四川', depth: 1 },
    ]);
    loadDialectSample.mockResolvedValue({
      id: 8,
      audio_url: 'can.mp3',
      concept_text: '舒服',
      duration_ms: 3200,
    });
    saveDialectProfile.mockResolvedValue({
      id: 7,
      nickname: '采集者',
      primary_dialect: { id: 3 },
    });
  });

  it('requires a nickname and primary dialect before saving', async () => {
    const wrapper = mountPage();
    wrapper.vm.nickname = '';
    wrapper.vm.next();
    expect(wrapper.vm.error).toBe('请输入昵称');

    wrapper.vm.nickname = '采集者';
    wrapper.vm.next();
    expect(wrapper.vm.step).toBe(2);
    await wrapper.vm.finish();
    expect(wrapper.vm.error).toBe('请选择主方言');
    expect(saveDialectProfile).not.toHaveBeenCalled();
  });

  it('loads a real sample and preserves interrupted navigation for new users', async () => {
    resumeInterruptedPageAfterLogin.mockReturnValueOnce(true);
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, { reason: 'new_user' });
    await flushPromises();
    wrapper.vm.next();
    await wrapper.vm.selectDialect(wrapper.vm.dialects[0]);
    await wrapper.vm.finish();

    expect(loadDialectSample).toHaveBeenCalledWith(3);
    expect(saveDialectProfile).toHaveBeenCalledWith(7, {
      nickname: '采集者',
      primaryDialectId: 3,
    });
    expect(resumeInterruptedPageAfterLogin).toHaveBeenCalledWith(7);
    expect(toFollowRecommendations).not.toHaveBeenCalled();
  });

  it('keeps the resume flow for existing users picking a missing dialect', async () => {
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, { reason: 'missing_dialect' });
    await flushPromises();
    wrapper.vm.next();
    await wrapper.vm.selectDialect(wrapper.vm.dialects[0]);
    await wrapper.vm.finish();

    expect(saveDialectProfile).toHaveBeenCalledWith(7, {
      nickname: '采集者',
      primaryDialectId: 3,
    });
    expect(resumeInterruptedPageAfterLogin).toHaveBeenCalledWith(7);
    expect(toFollowRecommendations).toHaveBeenCalledWith(true);
  });

  it('offers a retry when the dialect tree fails to load', async () => {
    listAllDialects.mockRejectedValueOnce(new Error('network down'));
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, {});
    await flushPromises();

    expect(wrapper.vm.dialectsError).toBe(true);

    wrapper.vm.step = 2;
    await flushPromises();
    expect(wrapper.text()).toContain('方言树加载失败');
    expect(wrapper.text()).not.toContain('西南官话.四川');

    await wrapper.vm.loadDialects();
    await flushPromises();

    expect(wrapper.vm.dialectsError).toBe(false);
    expect(wrapper.text()).toContain('西南官话.四川');
  });
});
