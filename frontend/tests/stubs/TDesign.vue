<template>
  <div>
    <slot />
    <slot name="description" />
    <slot name="action" />
  </div>
</template>

<script>
export default {
  name: 'TDesignStub',
  inheritAttrs: false,
  props: {
    block: { type: Boolean, default: false },
    autosize: { type: [Boolean, Object], default: false },
    ariaLabel: { type: String, default: '' },
    data: { type: Object, default: () => ({}) },
    delay: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false },
    help: { type: String, default: '' },
    icon: { type: [String, Object], default: '' },
    label: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    maxlength: { type: [String, Number], default: -1 },
    modelValue: { type: [String, Number, Array], default: '' },
    name: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    requiredMark: { type: Boolean, default: false },
    rules: { type: [Array, Object], default: () => [] },
    shape: { type: String, default: '' },
    size: { type: String, default: '' },
    text: { type: String, default: '' },
    theme: { type: String, default: '' },
    type: { type: String, default: '' },
    value: { type: [String, Number, Array], default: '' },
    variant: { type: String, default: '' },
  },
};
</script>
