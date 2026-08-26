<template>
  <view class="empty-state">
    <t-empty
      icon="info-circle"
    >
      <template #description>
        <view class="empty-title">
          {{ title }}
        </view>
        <view
          v-if="description"
          class="empty-description"
        >
          {{ description }}
        </view>
      </template>
      <template
        v-if="actionText"
        #action
      >
        <BaseButton
          size="small"
          :text="actionText"
          @click="$emit('action')"
        />
      </template>
    </t-empty>
  </view>
</template>

<script>
import TEmpty from '@tdesign/uniapp/empty/empty.vue';
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'EmptyState',
  components: { BaseButton, TEmpty },
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    actionText: { type: String, default: '' },
  },
  emits: ['action'],
};
</script>

<style scoped>
.empty-state {
  padding: 72rpx var(--space-3);
  text-align: center;
}

.empty-title {
  color: var(--text-secondary-color);
  font-size: 30rpx;
  font-weight: 700;
}

.empty-description {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
</style>
