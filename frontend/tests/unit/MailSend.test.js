import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mail', () => ({
  postMail: vi.fn(),
}));

const { default: MailSendPage } = await import('@/pages/mails/send.vue');

describe('mail send recipient', () => {
  it('does not leak route title parameters into the page shell', () => {
    expect(MailSendPage.inheritAttrs).toBe(false);
  });

  it('prefills the recipient from the query id', async () => {
    const wrapper = mount(MailSendPage, {
      global: {
        stubs: {
          PageShell: { template: '<main><slot /></main>' },
          SectionBlock: {
            props: ['title'],
            template: '<section><h2>{{ title }}</h2><slot /></section>',
          },
          BaseForm: {
            name: 'BaseForm',
            props: ['data', 'rules'],
            template: '<div><slot /></div>',
            methods: { validate() { return Promise.resolve(true); } },
          },
          BaseField: true,
          BaseButton: true,
        },
      },
    });
    wrapper.vm.applyRecipient(9);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.Notification.recipients).toEqual(['9']);
    expect(wrapper.vm.recipientLocked).toBe(true);
    expect(wrapper.vm.recipientLabel).toBe('用户 #9');
    expect(wrapper.text()).toContain('从同乡主页发起');
  });

  it('keeps a malformed query recipient editable', () => {
    const wrapper = mount(MailSendPage, {
      global: {
        stubs: {
          PageShell: { template: '<main><slot /></main>' },
          SectionBlock: { template: '<section><slot /></section>' },
          BaseForm: { template: '<div><slot /></div>' },
          BaseField: true,
          BaseButton: true,
        },
      },
    });

    wrapper.vm.applyRecipient('not-an-id');

    expect(wrapper.vm.recipientLocked).toBe(false);
    expect(wrapper.vm.Notification.recipients).toEqual(['not-an-id']);
  });
});
