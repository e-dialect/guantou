import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import AudioCapture from '@/components/AudioCapture.vue';
import { chooseAudioFile } from '@/services/file';
import { playAudio, playManaged, stopAudio } from '@/utils/audio';

vi.mock('@/services/file', () => ({
  chooseAudioFile: vi.fn(),
  supportsAudioFileSelection: vi.fn(() => true),
}));
vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
}));

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
    playManaged.mockReturnValue({ destroy: vi.fn() });
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

  it('plays and pauses a completed recording', () => {
    const wrapper = mountCapture({
      path: '/tmp/voice.mp3',
      name: 'voice.mp3',
      durationMs: 3200,
    });

    wrapper.vm.togglePlayback();

    expect(playManaged).toHaveBeenCalledWith(
      '/tmp/voice.mp3',
      expect.objectContaining({
        onEnded: expect.any(Function),
        onTimeUpdate: expect.any(Function),
      }),
    );
    expect(wrapper.vm.playing).toBe(true);

    wrapper.vm.togglePlayback();

    expect(stopAudio).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.playing).toBe(false);
  });

  it('offers playback and starts a fresh recording from the ready state', async () => {
    const wrapper = mountCapture({
      path: '/tmp/voice.mp3',
      name: 'voice.mp3',
      durationMs: 3200,
    });
    wrapper.vm.startRecord = vi.fn();

    expect(wrapper.text()).toContain('重新录制');
    expect(wrapper.text()).toContain('播放录音');

    wrapper.vm.restartRecording();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(wrapper.vm.startRecord).toHaveBeenCalledTimes(1);
  });
});
