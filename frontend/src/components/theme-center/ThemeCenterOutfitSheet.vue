<template>
  <view
    v-if="open"
    class="sheet-mask"
    @tap="$emit('close')"
  >
    <view class="sheet-mask-dim" />
    <view
      class="sheet"
      @tap.stop
    >
      <view class="sheet-title">
        {{ mode === 'rename' ? '重命名搭配方案' : '保存当前搭配' }}
      </view>
      <view class="muted">
        将当前全局主题与局部装扮保存为一套方案，方便下次一键还原。
      </view>
      <BaseForm
        :data="form"
        :rules="rules"
      >
        <BaseField
          :model-value="form.name"
          name="name"
          label="搭配名称"
          required
          clearable
          placeholder="例如：川渝市井全套"
          :maxlength="20"
          :error="error"
          @update:model-value="$emit('update-name', $event)"
        />
      </BaseForm>
      <view class="sheet-actions">
        <BaseButton
          variant="ghost"
          size="small"
          @click="$emit('close')"
        >
          取消
        </BaseButton>
        <BaseButton
          size="small"
          @click="$emit('confirm')"
        >
          保存
        </BaseButton>
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';

export default {
  name: 'ThemeCenterOutfitSheet',
  components: { BaseButton, BaseField, BaseForm },
  props: ['error', 'form', 'mode', 'open', 'rules'],
  emits: ['close', 'confirm', 'update-name'],
};
</script>
