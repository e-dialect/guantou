<template>
  <t-form-item
    class="base-field"
    :name="name"
    :label="label"
    :help="help"
    :required-mark="required"
    :rules="rules"
    label-align="top"
  >
    <view class="base-field-control">
      <slot>
        <t-textarea
          v-if="type === 'textarea'"
          :value="modelValue"
          :placeholder="placeholder"
          :maxlength="maxlength"
          :disabled="disabled"
          :readonly="readonly"
          :autosize="resolvedAutosize"
          :indicator="indicator"
          bordered
          @change="handleChange"
          @blur="$emit('blur', $event)"
          @focus="$emit('focus', $event)"
        />
        <t-input
          v-else
          :value="modelValue"
          :type="inputType"
          :placeholder="placeholder"
          :maxlength="maxlength"
          :disabled="disabled"
          :readonly="readonly"
          :clearable="clearable"
          :status="error ? 'error' : 'default'"
          borderless
          @change="handleChange"
          @blur="$emit('blur', $event)"
          @focus="$emit('focus', $event)"
        />
      </slot>
    </view>
    <view
      v-if="error"
      class="base-field-error"
    >
      {{ error }}
    </view>
  </t-form-item>
</template>

<script>
import TFormItem from '@tdesign/uniapp/form-item/form-item.vue';
import TInput from '@tdesign/uniapp/input/input.vue';
import TTextarea from '@tdesign/uniapp/textarea/textarea.vue';

export default {
  name: 'BaseField',
  components: { TFormItem, TInput, TTextarea },
  props: {
    modelValue: { type: [String, Number], default: '' },
    name: { type: String, required: true },
    label: { type: String, default: '' },
    type: {
      type: String,
      default: 'text',
      validator: (value) => ['text', 'textarea', 'number', 'digit', 'password', 'tel'].includes(value),
    },
    placeholder: { type: String, default: '' },
    maxlength: { type: Number, default: -1 },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    rules: { type: Array, default: () => [] },
    help: { type: String, default: '' },
    error: { type: String, default: '' },
    autosize: { type: [Boolean, Object], default: false },
    indicator: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change', 'input', 'blur', 'focus'],
  computed: {
    inputType() {
      if (this.type === 'tel') return 'number';
      return this.type;
    },
    resolvedAutosize() {
      if (this.autosize) return this.autosize;
      return { minHeight: 80 };
    },
  },
  methods: {
    handleChange(event) {
      const value = event?.detail?.value ?? event?.value ?? event ?? '';
      this.$emit('update:modelValue', value);
      this.$emit('change', value);
      this.$emit('input', value);
    },
  },
};
</script>

<style scoped>
.base-field {
  --td-form-item-border-color: transparent;
  --td-form-item-horizontal-padding: 0;
  --td-form-item-vertical-padding: var(--space-2);
  --td-input-bg-color: var(--surface-color);
  --td-input-vertical-padding: var(--space-2) var(--space-3);
  --td-textarea-background-color: var(--surface-color);
  --td-textarea-padding: var(--space-2) var(--space-3);
}

.base-field-error {
  margin-top: var(--space-1);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}

.base-field-control {
  width: 100%;
  min-width: 0;
}
</style>
