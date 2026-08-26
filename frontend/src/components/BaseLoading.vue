<template>
  <view
    v-if="loading"
    class="base-loading"
    :class="{ 'base-loading--fullscreen': fullscreen }"
  >
    <t-loading
      :loading="loading"
      :text="text"
      :delay="delay"
      :fullscreen="fullscreen"
      :layout="layout"
      theme="circular"
    />
  </view>
</template>

<script>
import TLoading from '@tdesign/uniapp/loading/loading.vue';

export default {
  name: 'BaseLoading',
  components: { TLoading },
  props: {
    loading: { type: Boolean, default: true },
    text: { type: String, default: '加载中…' },
    delay: { type: Number, default: 200 },
    fullscreen: { type: Boolean, default: false },
    layout: {
      type: String,
      default: 'vertical',
      validator: (value) => ['horizontal', 'vertical'].includes(value),
    },
  },
};
</script>

<style scoped>
.base-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5) var(--space-3);
  color: var(--muted-color);
}

.base-loading--fullscreen {
  padding: 0;
}
</style>
