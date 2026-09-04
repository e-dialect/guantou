<template>
  <text :class="['dialect-label', `dialect-label--${mode}`]">
    {{ text }}
  </text>
</template>

<script>
import { dialectBreadcrumb, dialectCardLabel } from '@/utils/dialectTree';

export default {
  name: 'DialectLabel',
  props: {
    dialect: { type: Object, default: () => ({}) },
    dialects: { type: Array, default: () => [] },
    mode: {
      type: String,
      default: 'card',
      validator: (value) => ['card', 'detail'].includes(value),
    },
  },
  computed: {
    text() {
      return this.mode === 'detail'
        ? dialectBreadcrumb(this.dialect, this.dialects)
        : dialectCardLabel(this.dialect, this.dialects);
    },
  },
};
</script>

<style scoped>
.dialect-label {
  overflow-wrap: anywhere;
}

.dialect-label--detail {
  line-height: 1.6;
}
</style>
