<template>
  <view
    v-if="open"
    class="sheet-mask"
  >
    <view class="sheet-mask-dim" />
    <view
      class="sheet"
      @tap.stop
    >
      <view class="sheet-title">
        检测到本地存在装扮配置，是否合并到账号？
      </view>
      <view class="muted">
        云端装扮配置优先。你可以选择使用云端、使用本地，或合并两者。
      </view>
      <view class="action-stack">
        <BaseButton @click="$emit('choose', 'cloud')">
          使用云端配置
        </BaseButton>
        <BaseButton
          variant="ghost"
          @click="$emit('choose', 'local')"
        >
          使用本地配置
        </BaseButton>
        <BaseButton
          variant="ghost"
          @click="$emit('choose', 'merge')"
        >
          合并两者
        </BaseButton>
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'ThemeCenterMergeSheet',
  components: { BaseButton },
  props: ['open'],
  emits: ['choose'],
};
</script>
