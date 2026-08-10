import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/canSocial', () => ({
  likeCan: vi.fn(),
  unlikeCan: vi.fn(),
}));

vi.mock('@/utils/shareCan', () => ({
  shareCanOnWeb: vi.fn(),
}));

vi.mock('@/services/canPostJourney', () => ({
  startUseSame: vi.fn(),
}));

import CanCard from '@/components/CanCard.vue';
import { playAudio } from '@/utils/audio';
import { likeCan } from '@/services/canSocial';
import { startUseSame } from '@/services/canPostJourney';

function mountCard(can = {}, props = {}) {
  return mount(CanCard, {
    props: {
      can: {
        id: 7,
        audio_url: 'https://example.com/can.mp3',
        duration_ms: 4200,
        primary_nameplate: { display_text: '巴适' },
        submitted_dialect: { qualified_code: '西南官话.四川' },
        nameplate_count: 2,
        ...can,
      },
      ...props,
    },
  });
}

describe('CanCard audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    likeCan.mockResolvedValue({ liked: true, like_count: 4 });
  });

  it('plays audio without opening the card', async () => {
    const wrapper = mountCard();

    await wrapper.find('.play-button').trigger('tap');

    expect(playAudio).toHaveBeenCalledWith('https://example.com/can.mp3');
    expect(wrapper.emitted('open')).toBeUndefined();
    expect(wrapper.text()).toContain('听乡音 · 4 秒');
  });

  it('shows a disabled state when audio is unavailable', () => {
    const wrapper = mountCard({ audio_url: '' });

    expect(wrapper.find('.play-button').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('暂无可播放音频');
  });

  it('likes and opens social targets without opening the card', async () => {
    const wrapper = mountCard({
      like_count: 3,
      liked_by_me: false,
      comment_count: 2,
      recorder: { id: 9, nickname: '录音者' },
    }, { social: true });

    await wrapper.find('.author-row').trigger('tap');
    await wrapper.findAll('.social-button')[0].trigger('tap');
    await wrapper.findAll('.social-button')[1].trigger('tap');

    expect(wrapper.emitted('author')[0]).toEqual([9]);
    expect(wrapper.emitted('comment')[0]).toEqual([7]);
    expect(likeCan).toHaveBeenCalledWith(7);
    expect(wrapper.text()).toContain('♥ 4');
    expect(wrapper.emitted('open')).toBeUndefined();
  });

  it('starts Can-first use-same without opening the card', async () => {
    const wrapper = mountCard({ use_count: 2 }, { social: true });

    await wrapper.findAll('.social-button')[2].trigger('tap');

    expect(startUseSame).toHaveBeenCalledWith(7, { page: 'can_feed' });
    expect(wrapper.text()).toContain('同款 2');
    expect(wrapper.emitted('open')).toBeUndefined();
  });
});
