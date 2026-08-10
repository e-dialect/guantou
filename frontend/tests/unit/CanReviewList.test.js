import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({ listCans: vi.fn() }));

import CanIndex from '@/pages/cans/index.vue';

function mountPage(isStaff) {
  globalThis.getApp = () => ({ globalData: { userInfo: { is_staff: isStaff } } });
  return mount(CanIndex, {
    global: {
      stubs: {
        CanList: true,
        PageShell: {
          template: '<main><slot name="before" /><slot /></main>',
        },
        picker: { template: '<div class="status-picker"><slot /></div>' },
      },
    },
  });
}

describe('can review list', () => {
  beforeEach(() => {
    globalThis.uni = { navigateTo: vi.fn() };
  });

  it('shows review filters only to staff', () => {
    const guest = mountPage(false);
    expect(guest.find('.status-picker').exists()).toBe(false);

    const staff = mountPage(true);
    expect(staff.find('.status-picker').exists()).toBe(true);
    expect(staff.text()).toContain('全部状态');
  });
});
