<template>
  <view
    v-if="compact"
    class="theme-status-pane theme-status-pane--compact"
    role="status"
  >
    <view class="theme-status-pane__copy">
      <view class="theme-status-pane__title">
        {{ copy.title }}
      </view>
      <view
        v-if="copy.description"
        class="theme-status-pane__description"
      >
        {{ copy.description }}
      </view>
    </view>
    <BaseButton
      v-if="copy.actionText"
      class="theme-status-pane__action"
      size="extra-small"
      variant="ghost"
      :text="copy.actionText"
      @click="onAction"
    />
  </view>
  <EmptyState
    v-else
    :title="copy.title"
    :description="copy.description"
    :action-text="copy.actionText"
    @action="onAction"
  />
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { trackThemeEmptyClick, trackThemeEmptyShow } from '@/services/themeAnalytics';
import { themeEmptyCopy } from '@/services/themeStatus';

export default {
  name: 'ThemeStatusPane',
  components: { BaseButton, EmptyState },
  props: {
    compact: { type: Boolean, default: false },
    scene: { type: String, required: true },
  },
  emits: ['action'],
  computed: {
    copy() {
      return themeEmptyCopy(this.scene);
    },
  },
  watch: {
    scene: {
      immediate: true,
      handler(scene) {
        if (scene) trackThemeEmptyShow(scene);
      },
    },
  },
  methods: {
    onAction() {
      trackThemeEmptyClick(this.scene, this.copy.action);
      this.$emit('action');
    },
  },
};
</script>

<style scoped>
.theme-status-pane--compact {
  display: flex;
  min-height: 64rpx;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-1);
  padding: var(--space-2) 0 var(--space-1);
}

.theme-status-pane__copy {
  min-width: 0;
  flex: 1;
}

.theme-status-pane__title,
.theme-status-pane__description {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.theme-status-pane__description {
  margin-top: var(--space-1);
}

.theme-status-pane__action {
  flex-shrink: 0;
}
</style>
