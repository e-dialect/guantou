<template>
  <t-form
    ref="form"
    class="base-form"
    :data="data"
    :rules="rules"
    :label-align="labelAlign"
    :label-width="labelWidth"
    :required-mark="requiredMark"
    :reset-type="resetType"
    :show-error-message="showErrorMessage"
    :scroll-to-first-error="scrollToFirstError"
    @submit="$emit('submit', $event)"
    @validate="$emit('validate', $event)"
    @reset="$emit('reset', $event)"
  >
    <slot />
  </t-form>
</template>

<script>
import TForm from '@tdesign/uniapp/form/form.vue';

export default {
  name: 'BaseForm',
  components: { TForm },
  props: {
    data: { type: Object, required: true },
    rules: { type: Object, default: () => ({}) },
    labelAlign: {
      type: String,
      default: 'top',
      validator: (value) => ['left', 'right', 'top'].includes(value),
    },
    // TDesign defaults labelWidth to 81px even for top-aligned forms. An empty
    // value lets top labels and controls use the full row width.
    labelWidth: { type: [String, Number], default: '' },
    requiredMark: { type: Boolean, default: true },
    resetType: {
      type: String,
      default: 'initial',
      validator: (value) => ['empty', 'initial'].includes(value),
    },
    showErrorMessage: { type: Boolean, default: true },
    scrollToFirstError: {
      type: String,
      default: 'smooth',
      validator: (value) => ['', 'smooth', 'auto'].includes(value),
    },
  },
  emits: ['reset', 'submit', 'validate'],
  methods: {
    formMethod(name, ...args) {
      const { form } = this.$refs;
      if (!form || typeof form[name] !== 'function') return undefined;
      return form[name](...args);
    },
    validate(params) {
      return this.formMethod('validate', params);
    },
    reset(params) {
      return this.formMethod('reset', params);
    },
    submit(params) {
      return this.formMethod('submit', params);
    },
    clearValidate(fields) {
      return this.formMethod('clearValidate', fields);
    },
    setValidateMessage(message) {
      return this.formMethod('setValidateMessage', message);
    },
  },
};
</script>

<style scoped>
.base-form {
  --td-form-bg-color: transparent;
  --td-form-item-horizontal-padding: 0;
  --td-form-item-vertical-padding: var(--space-2);
}
</style>
