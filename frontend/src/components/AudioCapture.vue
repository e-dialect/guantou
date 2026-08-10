<template>
  <view class="audio-capture">
    <view
      :class="[
        'record-zone',
        recording ? 'recording' : '',
        audio.path ? 'ready' : '',
        recordingSupported ? '' : 'disabled',
      ]"
      @longpress="startRecord"
      @touchend="stopRecord"
      @mousedown="startRecord"
      @mouseup="stopRecord"
      @mouseleave="stopRecord"
    >
      <text class="record-title">
        {{ titleText }}
      </text>
      <text class="record-subtitle">
        {{ subtitleText }}
      </text>
    </view>

    <view class="actions">
      <button
        v-if="audio.path"
        class="secondary-button"
        @tap="previewAudio"
      >
        试听
      </button>
      <button
        v-if="audio.path || audio.invalid"
        class="secondary-button danger"
        @tap="clearAudio"
      >
        重录
      </button>
      <button
        class="secondary-button"
        :disabled="!fileSelectionSupported"
        @tap="chooseFile"
      >
        上传音频
      </button>
    </view>
  </view>
</template>

<script>
import {
  chooseAudioFile,
  supportsAudioFileSelection,
} from '@/services/file';
import { playAudio } from '@/utils/audio';

const MAX_DURATION_MS = 15000;
const MIN_DURATION_MS = 1000;

export default {
  name: 'AudioCapture',
  props: {
    audio: {
      type: Object,
      default: () => ({
        path: '',
        name: '',
        durationMs: 0,
        origin: '',
      }),
    },
  },
  emits: ['change', 'clear'],
  data() {
    return {
      recorderManager: null,
      mediaStream: null,
      recordingSupported: false,
      fileSelectionSupported: supportsAudioFileSelection(),
      recording: false,
      recordIntentActive: false,
      recordStartedAt: 0,
      stopTimer: null,
    };
  },
  computed: {
    titleText() {
      if (this.recording) return '录音中，松手完成';
      if (this.audio.invalid) return '录音已失效，请重录';
      if (this.audio.path) return this.audio.name || '已准备好音频';
      if (!this.recordingSupported) return '当前环境不支持录音';
      return '按住录音';
    },
    subtitleText() {
      if (this.recording) return '最长 15 秒';
      if (this.audio.invalid) return '草稿的其他内容已恢复';
      if (this.audio.path && this.audio.durationMs) {
        return `约 ${Math.max(1, Math.round(this.audio.durationMs / 1000))} 秒`;
      }
      if (this.audio.path) return '可以试听或重录';
      if (!this.recordingSupported) {
        return this.fileSelectionSupported
          ? '请上传音频文件继续'
          : '当前环境也不支持选择音频文件';
      }
      return '也可以上传 mp3、wav、m4a';
    },
  },
  mounted() {
    this.initRecorder();
  },
  beforeUnmount() {
    this.clearTimer();
    if (this.recorderManager && typeof this.recorderManager.stop === 'function') {
      try {
        this.recorderManager.stop();
      } catch (error) {
        // Recorder may already be inactive.
      }
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  },
  methods: {
    emitAudio(path, durationMs, origin, name = '', blob = null) {
      this.$emit('change', {
        path,
        name,
        durationMs,
        origin,
        available: true,
        invalid: false,
        ...(blob ? { blob } : {}),
      });
    },
    clearTimer() {
      if (!this.stopTimer) return;
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    },
    initRecorder() {
      // #ifndef H5
      if (typeof uni.getRecorderManager !== 'function') return;
      this.recorderManager = uni.getRecorderManager();
      this.recordingSupported = Boolean(this.recorderManager);
      this.recorderManager.onStop((res) => {
        const durationMs = Date.now() - this.recordStartedAt;
        this.onRecordStop(res.tempFilePath, durationMs);
      });
      this.recorderManager.onError(() => {
        this.recording = false;
        this.recordIntentActive = false;
        this.clearTimer();
        uni.showToast({ title: '需要麦克风权限才能录音', icon: 'none' });
      });
      // #endif

      // #ifdef H5
      this.recordingSupported = Boolean(
        typeof navigator !== 'undefined'
        && navigator.mediaDevices
        && navigator.mediaDevices.getUserMedia
        && typeof MediaRecorder !== 'undefined',
      );
      // #endif
    },
    async prepareH5Recorder() {
      let prepared = false;
      // #ifdef H5
      if (this.recorderManager) return true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaStream = stream;
        this.recorderManager = new MediaRecorder(stream);
        let chunks = [];
        this.recorderManager.onstart = () => {
          chunks = [];
        };
        this.recorderManager.ondataavailable = (event) => {
          chunks.push(event.data);
        };
        this.recorderManager.onstop = () => {
          const durationMs = Date.now() - this.recordStartedAt;
          const blob = new Blob(chunks, { type: this.recorderManager.mimeType });
          const path = window.URL.createObjectURL(blob);
          this.onRecordStop(path, durationMs, blob);
        };
        prepared = true;
      } catch (error) {
        this.recorderManager = null;
        uni.showToast({ title: '需要麦克风权限才能录音', icon: 'none' });
      }
      // #endif

      // #ifndef H5
      prepared = Boolean(this.recorderManager);
      // #endif
      return prepared;
    },
    async startRecord() {
      if (this.recording) return;
      this.recordIntentActive = true;
      if (!this.recordingSupported) {
        this.recordIntentActive = false;
        uni.showToast({ title: '当前环境不能录音，请上传音频', icon: 'none' });
        return;
      }
      if (!this.recorderManager && !await this.prepareH5Recorder()) return;
      if (!this.recordIntentActive) return;
      this.recording = true;
      this.recordStartedAt = Date.now();
      this.clearTimer();
      this.stopTimer = setTimeout(() => {
        this.stopRecord(true);
      }, MAX_DURATION_MS);
      this.recorderManager.start();
    },
    stopRecord(autoStopped = false) {
      this.recordIntentActive = false;
      if (!this.recording || !this.recorderManager) return;
      this.recording = false;
      this.clearTimer();
      try {
        this.recorderManager.stop();
      } catch (error) {
        this.recording = false;
      }
      if (autoStopped) {
        uni.showToast({ title: '已自动截取前15秒', icon: 'none' });
      }
    },
    onRecordStop(path, durationMs, blob = null) {
      this.recording = false;
      this.clearTimer();
      if (!path) return;
      if (durationMs < MIN_DURATION_MS) {
        uni.showToast({ title: '录音太短了，再试一次吧', icon: 'none' });
        return;
      }
      this.emitAudio(
        path,
        Math.min(durationMs, MAX_DURATION_MS),
        'record',
        '刚录好的乡音',
        blob,
      );
    },
    previewAudio() {
      playAudio(this.audio.path);
    },
    clearAudio() {
      this.$emit('clear');
    },
    async chooseFile() {
      if (!this.fileSelectionSupported) {
        uni.showToast({ title: '当前环境不支持选择音频文件', icon: 'none' });
        return;
      }
      try {
        const file = await chooseAudioFile();
        this.emitAudio(file.path, 0, 'upload', file.name);
      } catch (error) {
        uni.showToast({
          title: error.errMsg || error.message || '选择音频失败',
          icon: 'none',
        });
      }
    },
  },
};
</script>

<style scoped>
.audio-capture {
  margin: 28rpx 0;
}

.record-zone {
  border: 2rpx dashed #9db2a6;
  border-radius: 16rpx;
  background: #ffffff;
  min-height: 220rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #2f4638;
}

.record-zone.recording {
  border-color: #1f5c43;
  background: #e8f1eb;
}

.record-zone.ready {
  border-style: solid;
}

.record-zone.disabled {
  opacity: 0.6;
}

.record-title {
  font-size: 34rpx;
  font-weight: 700;
}

.record-subtitle {
  font-size: 26rpx;
  color: #6a766e;
}

.actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 18rpx;
  flex-wrap: wrap;
}

.secondary-button {
  margin: 0;
  background: #ffffff;
  border: 1px solid #cbd5c5;
  color: #2f4638;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.danger {
  color: #a33a2d;
}
</style>
