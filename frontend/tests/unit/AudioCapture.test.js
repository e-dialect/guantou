import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/file', () => ({
  chooseAudioFile: vi.fn(),
  supportsAudioFileSelection: vi.fn(() => true),
}));
vi.mock('@/utils/audio', () => ({ playAudio: vi.fn() }));

import AudioCapture from '@/components/AudioCapture.vue';
import { chooseAudioFile } from '@/services/file';
import { playAudio } from '@/utils/audio';

function mountCapture(audio = {}) {
  return mount(AudioCapture, {
    props: {
      audio: {
        path: '',
        name: '',
        durationMs: 0,
        origin: '',
        ...audio,
      },
    },
  });
}

describe('AudioCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn() };
  });

  it('rejects recordings shorter than one second', () => {
    const wrapper = mountCapture();

    wrapper.vm.onRecordStop('blob:short', 999);

    expect(wrapper.emitted('change')).toBeUndefined();
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '录音太短了，再试一次吧',
      icon: 'none',
    });
  });

  it('automatically stops at fifteen seconds', async () => {
    vi.useFakeTimers();
    const wrapper = mountCapture();
    const recorder = { start: vi.fn(), stop: vi.fn() };
    wrapper.vm.recorderManager = recorder;
    wrapper.vm.recordingSupported = true;

    await wrapper.vm.startRecord();
    vi.advanceTimersByTime(15000);

    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith({
      title: '已自动截取前15秒',
      icon: 'none',
    });
    vi.useRealTimers();
  });

  it('previews, clears, and replaces a local audio file', async () => {
    chooseAudioFile.mockResolvedValue({
      path: '/tmp/voice.m4a',
      name: 'voice.m4a',
    });
    const wrapper = mountCapture({ path: '/tmp/old.mp3', name: 'old.mp3' });

    wrapper.vm.previewAudio();
    wrapper.vm.clearAudio();
    await wrapper.vm.chooseFile();

    expect(playAudio).toHaveBeenCalledWith('/tmp/old.mp3');
    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(wrapper.emitted('change')[0][0]).toMatchObject({
      path: '/tmp/voice.m4a',
      name: 'voice.m4a',
      origin: 'upload',
    });
  });
});
