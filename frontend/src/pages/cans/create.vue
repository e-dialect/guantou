<template>
  <view class="page">
    <view class="topbar">
      <text
        class="back"
        @tap="goBack"
      >
        ‹
      </text>
      <text class="title">
        装一罐
      </text>
    </view>

    <scroll-view
      scroll-y
      class="content"
    >
      <uni-forms label-position="top">
        <uni-forms-item label="普通话概念">
          <input
            v-model="form.concept_text"
            class="field"
            placeholder="例如：膝盖、祖母、走路"
            maxlength="20"
          >
        </uni-forms-item>
        <uni-forms-item label="方言点">
          <picker
            :range="dialects"
            range-key="name"
            @change="onDialectChange"
          >
            <view class="select">
              {{ dialectLabel }}
            </view>
          </picker>
        </uni-forms-item>

        <view class="optional-head">
          <text>补充信息（选填）</text>
          <text
            class="optional-toggle"
            @tap="optionalOpen = !optionalOpen"
          >
            {{ optionalOpen ? '收起' : '展开' }}
          </text>
        </view>

        <view v-if="optionalOpen">
          <uni-forms-item label="候选写法">
            <input
              v-model="label.text_content"
              class="field"
              maxlength="10"
              placeholder="不确定正字可先空着"
            >
          </uni-forms-item>
          <uni-forms-item label="释义">
            <textarea
              v-model="label.definition"
              class="textarea"
              maxlength="50"
              placeholder="这个词是什么意思？"
            />
          </uni-forms-item>
          <uni-forms-item label="写法类型">
            <picker
              :range="packageTypes"
              range-key="label"
              @change="onPackageTypeChange"
            >
              <view class="select">
                {{ packageTypeLabel }}
              </view>
            </picker>
          </uni-forms-item>
          <uni-forms-item label="证据等级">
            <picker
              :range="evidenceLevels"
              range-key="label"
              @change="onEvidenceChange"
            >
              <view class="select">
                {{ evidenceLabel }}
              </view>
            </picker>
          </uni-forms-item>
          <uni-forms-item label="产地">
            <view class="split">
              <input
                v-model="form.county"
                class="field"
                placeholder="县区"
              >
              <input
                v-model="form.town"
                class="field"
                placeholder="乡镇/社区"
              >
            </view>
          </uni-forms-item>
          <uni-forms-item label="来源说明">
            <input
              v-model="form.source_note"
              class="field"
              maxlength="50"
              placeholder="比如：听奶奶说的"
            >
          </uni-forms-item>
        </view>
      </uni-forms>

      <view class="form-hint">
        不会写正字也没关系，先录下来最重要
      </view>

      <view class="recorder">
        <button
          class="record-button"
          @longpress="startRecord"
          @touchend="stopRecord"
        >
          {{ recordText }}
        </button>
        <button
          v-if="form.audio_url"
          class="secondary-button"
          @tap="playAudio(form.audio_url)"
        >
          播放录音
        </button>
        <button
          v-if="form.audio_url"
          class="secondary-button danger"
          @tap="form.audio_url = ''"
        >
          重新录制
        </button>
      </view>

      <button
        class="primary-button"
        :disabled="submitting || !canSubmit"
        @tap="submit"
      >
        {{ submitting ? '提交中...' : '封存这罐乡音' }}
      </button>
    </scroll-view>
  </view>
</template>

<script>
import { uploadFile } from '@/services/file';
import { createCanWithNameplate, listDialects } from '@/services/guantou';
import { playAudio } from '@/utils/audio';

export default {
  data() {
    return {
      submitting: false,
      optionalOpen: false,
      recorderManager: null,
      recording: false,
      dialects: [],
      form: {
        audio_url: '',
        concept_text: '',
        dialect: null,
        county: '',
        town: '',
        source_note: '',
      },
      label: {
        text_content: '',
        definition: '',
        package_type: 'uncertain',
        evidence_level: 1,
        source_citation: '',
      },
      packageTypes: [
        { label: '不确定', value: 'uncertain' },
        { label: '正字', value: 'orthodox' },
        { label: '借字', value: 'loan' },
        { label: '俗写', value: 'popular' },
        { label: '拟音', value: 'phonetic' },
        { label: '罗马字', value: 'romanization' },
      ],
      evidenceLevels: [
        { label: '本人记忆', value: 1 },
        { label: '社区公认', value: 2 },
        { label: '文献考据', value: 3 },
        { label: '官方认证', value: 4 },
      ],
    };
  },
  computed: {
    recordText() {
      if (this.recording) return '松开结束';
      return this.form.audio_url ? '已录音' : '长按录音';
    },
    packageTypeLabel() {
      return this.packageTypes.find((item) => item.value === this.label.package_type).label;
    },
    evidenceLabel() {
      return this.evidenceLevels.find((item) => item.value === this.label.evidence_level).label;
    },
    dialectLabel() {
      const dialect = this.dialects.find((item) => item.id === this.form.dialect);
      return dialect ? dialect.name : '请选择方言点';
    },
    canSubmit() {
      return Boolean(
        this.form.concept_text.trim()
        && this.form.dialect
        && this.form.audio_url,
      );
    },
  },
  async onLoad() {
    const res = await listDialects();
    this.dialects = res.results || res;
    this.initRecorder();
  },
  methods: {
    playAudio,
    goBack() {
      uni.navigateBack();
    },
    onPackageTypeChange(e) {
      this.label.package_type = this.packageTypes[e.detail.value].value;
    },
    onEvidenceChange(e) {
      this.label.evidence_level = this.evidenceLevels[e.detail.value].value;
    },
    onDialectChange(e) {
      const dialect = this.dialects[e.detail.value];
      this.form.dialect = dialect.id;
      this.form.county = this.form.county || dialect.county || '';
      this.form.town = this.form.town || dialect.town || '';
    },
    initRecorder() {
      // #ifndef H5
      this.recorderManager = uni.getRecorderManager();
      this.recorderManager.onStop((res) => {
        this.form.audio_url = res.tempFilePath;
        this.recording = false;
      });
      // #endif
      // #ifdef H5
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this.recorderManager = new MediaRecorder(stream);
        let chunks = [];
        this.recorderManager.onstart = () => { chunks = []; };
        this.recorderManager.ondataavailable = (event) => chunks.push(event.data);
        this.recorderManager.onstop = () => {
          const blob = new Blob(chunks, { type: this.recorderManager.mimeType });
          this.form.audio_url = window.URL.createObjectURL(blob);
          this.recording = false;
        };
      });
      // #endif
    },
    startRecord() {
      if (!this.recorderManager) {
        uni.showToast({ title: '当前环境不能录音', icon: 'none' });
        return;
      }
      this.recording = true;
      this.recorderManager.start();
    },
    stopRecord() {
      if (!this.recording || !this.recorderManager) return;
      this.recorderManager.stop();
    },
    async submit() {
      if (!uni.getStorageSync('token')) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      if (!this.canSubmit) {
        uni.showToast({ title: '请填写概念、方言点并录音', icon: 'none' });
        return;
      }
      this.submitting = true;
      try {
        const uploaded = await uploadFile(this.form.audio_url);
        const can = await createCanWithNameplate({
          can: { ...this.form, audio_url: uploaded.url },
          label: this.label,
        });
        uni.redirectTo({ url: `/pages/cans/details?id=${can.id}` });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f6f7f3;
  color: #1d2a24;
}

.topbar {
  height: 96rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background: #ffffff;
  border-bottom: 1px solid #e8ebe4;
}

.back {
  font-size: 56rpx;
  width: 56rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
}

.content {
  height: calc(100vh - 96rpx);
  padding: 28rpx;
  box-sizing: border-box;
}

.field,
.textarea,
.select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  background: #fff;
  padding: 22rpx;
  font-size: 30rpx;
}

.optional-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #d9dfd5;
  border-radius: 12rpx;
  padding: 22rpx;
  margin-bottom: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.optional-toggle {
  color: #1f5c43;
  font-size: 26rpx;
  font-weight: 500;
}

.form-hint {
  color: #6a766e;
  font-size: 26rpx;
}

.textarea {
  min-height: 150rpx;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.recorder {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin: 28rpx 0;
  flex-wrap: wrap;
}

.record-button {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: #2f6b4f;
  color: white;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.secondary-button {
  background: #ffffff;
  border: 1px solid #cbd5c5;
  color: #2f4638;
}

.danger {
  color: #a33a2d;
}

.primary-button {
  margin: 24rpx 0 64rpx;
  background: #1f5c43;
  color: white;
  border-radius: 12rpx;
}

.primary-button[disabled] {
  background: #aeb9b1;
}
</style>
