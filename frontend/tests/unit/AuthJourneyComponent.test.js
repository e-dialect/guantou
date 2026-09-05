import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AuthJourney from '@/pages/login/components/AuthJourney.vue';

describe('AuthJourney component', () => {
  it('exposes real journey progress and keeps hero and form content together', () => {
    const wrapper = mount(AuthJourney, {
      props: {
        eyebrow: '建立乡声档案',
        title: '先留下一个署名',
        lead: '设置账号后继续完善身份。',
        step: 2,
        stepTotal: 4,
        stepLabel: '验证邮箱',
      },
      slots: {
        hero: '<div class="journey-context">登录后继续</div>',
        default: '<div class="journey-form">表单内容</div>',
      },
    });

    const progress = wrapper.get('[role="progressbar"]');
    expect(progress.attributes('aria-label')).toBe('验证邮箱：第 2 步，共 4 步');
    expect(progress.attributes('aria-valuenow')).toBe('2');
    expect(wrapper.get('.auth-journey__progress-value').attributes('style')).toContain('50%');
    expect(wrapper.text()).toContain('登录后继续');
    expect(wrapper.text()).toContain('表单内容');
  });
});
