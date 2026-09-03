import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import confirmDialog from '@/components/ConfirmDialog';

describe('BaseButton', () => {
  it('forwards recording action icons explicitly on both platforms', () => {
    const wrapper = mount(BaseButton, { props: { icon: 'refresh' } });
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('icon')).toBe('refresh');
  });

  it('renders the primary variant with slot text by default', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: '提交铭牌' },
    });

    const button = wrapper.getComponent({ name: 'TDesignStub' });
    expect(button.props('theme')).toBe('primary');
    expect(button.props('variant')).toBe('base');
    expect(button.props('size')).toBe('medium');
    expect(wrapper.text()).toContain('提交铭牌');
  });

  it('supports ghost and danger variants with block sizing', () => {
    const ghost = mount(BaseButton, {
      props: { variant: 'ghost', block: true },
    });
    expect(ghost.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      block: true,
      theme: 'primary',
      variant: 'outline',
    });

    const danger = mount(BaseButton, {
      props: { variant: 'danger', size: 'small', text: '删除' },
    });
    expect(danger.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      size: 'small',
      theme: 'danger',
      variant: 'base',
    });
    expect(danger.text()).toContain('删除');

    const dangerGhost = mount(BaseButton, {
      props: { variant: 'danger-ghost', text: '立论' },
    });
    expect(dangerGhost.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      theme: 'danger',
      variant: 'outline',
    });
  });

  it('emits click on tap but not when disabled or loading', async () => {
    const wrapper = mount(BaseButton);
    wrapper.getComponent({ name: 'TDesignStub' }).vm.$emit('click', { detail: {} });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('click')).toHaveLength(1);

    const disabled = mount(BaseButton, { props: { disabled: true } });
    disabled.getComponent({ name: 'TDesignStub' }).vm.$emit('click');
    await disabled.vm.$nextTick();
    expect(disabled.emitted('click')).toBeUndefined();

    const loading = mount(BaseButton, { props: { loading: true } });
    loading.getComponent({ name: 'TDesignStub' }).vm.$emit('click');
    await loading.vm.$nextTick();
    expect(loading.emitted('click')).toBeUndefined();
  });
});

describe('BaseField', () => {
  it('wraps a picker trigger without rendering an extra text input', () => {
    const wrapper = mount(BaseField, {
      props: { name: 'dialect', label: '方言点', error: '请选择方言点' },
      slots: { default: '<div class="dialect-trigger">选择方言</div>' },
    });
    expect(wrapper.find('.dialect-trigger').exists()).toBe(true);
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(1);
    expect(wrapper.find('.base-field-error').text()).toBe('请选择方言点');
  });

  it('preserves completion icons while server errors take precedence over success', async () => {
    const suffixIcon = { name: 'check-circle-filled' };
    const wrapper = mount(BaseField, {
      props: { name: 'concept', status: 'success', suffixIcon, error: '概念有误' },
    });
    const input = wrapper.findAllComponents({ name: 'TDesignStub' })[1];
    expect(input.attributes('status')).toBeUndefined();
    expect(input.vm.$attrs.status).toBe('error');
    expect(input.vm.$attrs['suffix-icon']).toEqual(suffixIcon);

    await wrapper.setProps({ error: '' });
    expect(input.vm.$attrs.status).toBe('success');
    expect(input.vm.$attrs['suffix-icon']).toEqual(suffixIcon);
  });

  it('renders label, required mark and error text', () => {
    const wrapper = mount(BaseField, {
      props: {
        name: 'nickname',
        label: '昵称',
        required: true,
        error: '昵称不能为空',
      },
    });

    const formItem = wrapper.findAllComponents({ name: 'TDesignStub' })[0];
    expect(formItem.props('label')).toBe('昵称');
    expect(formItem.props('requiredMark')).toBe(true);
    expect(wrapper.find('.base-field-error').text()).toBe('昵称不能为空');
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(2);
  });

  it('keeps field semantics with a custom picker control instead of rendering an input', () => {
    const wrapper = mount(BaseField, {
      props: { name: 'dialect_id', label: '方言点', help: '请选择当地记录', required: true },
      slots: { default: '<div class="custom-control">闽语 · 莆仙片</div>' },
    });
    expect(wrapper.findAllComponents({ name: 'TDesignStub' })).toHaveLength(1);
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props()).toMatchObject({
      name: 'dialect_id', label: '方言点', help: '请选择当地记录', requiredMark: true,
    });
    expect(wrapper.get('.custom-control').text()).toBe('闽语 · 莆仙片');
  });

  it('uses textarea and emits v-model updates on input', async () => {
    const wrapper = mount(BaseField, {
      props: { name: 'definition', type: 'textarea', modelValue: '' },
    });

    const textarea = wrapper.findAllComponents({ name: 'TDesignStub' })[1];
    textarea.vm.$emit('change', { detail: { value: '罐头释义' } });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['罐头释义']);
    expect(wrapper.emitted('input')[0]).toEqual(['罐头释义']);
  });
});

describe('TDesign infrastructure primitives', () => {
  it('forwards form methods and defaults to top labels', async () => {
    const wrapper = mount(BaseForm, { props: { data: { nickname: '' } } });
    const form = wrapper.getComponent({ name: 'TDesignStub' });
    form.vm.validate = vi.fn(() => Promise.resolve(true));

    expect(form.props('data')).toEqual({ nickname: '' });
    await expect(wrapper.vm.validate()).resolves.toBe(true);
    expect(form.vm.validate).toHaveBeenCalledOnce();
  });

  it('renders loading only while active', async () => {
    const wrapper = mount(BaseLoading, { props: { loading: false } });
    expect(wrapper.findComponent({ name: 'TDesignStub' }).exists()).toBe(false);
    await wrapper.setProps({ loading: true, text: '载入方言' });
    expect(wrapper.getComponent({ name: 'TDesignStub' }).props('text')).toBe('载入方言');
  });

  it('keeps the existing empty-state action contract', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '还没有内容', actionText: '去创建' },
    });
    const button = wrapper.getComponent(BaseButton);
    button.vm.$emit('click');
    expect(wrapper.emitted('action')).toHaveLength(1);
  });
});

describe('confirmDialog', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-undef
    globalThis.uni = { showModal: vi.fn() };
  });

  it('resolves true when the user confirms', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    await expect(confirmDialog({ title: '删除罐头？' })).resolves.toBe(true);
    expect(uni.showModal.mock.calls[0][0].title).toBe('删除罐头？');
    expect(uni.showModal.mock.calls[0][0].confirmColor).toBeUndefined();
  });

  it('resolves false when the user cancels or the modal fails', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: false }));
    await expect(confirmDialog()).resolves.toBe(false);

    uni.showModal.mockImplementation(({ fail }) => fail(new Error('denied')));
    await expect(confirmDialog()).resolves.toBe(false);
  });

  it('applies the danger confirm color for destructive actions', async () => {
    uni.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    await confirmDialog({ danger: true });
    expect(uni.showModal.mock.calls[0][0].confirmColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
