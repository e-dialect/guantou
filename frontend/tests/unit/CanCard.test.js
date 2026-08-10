import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
}));

import CanCard from '@/components/CanCard.vue';
import { playAudio } from '@/utils/audio';

function mountCard(can = {}) {
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
    },
  });
}

describe('CanCard audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
