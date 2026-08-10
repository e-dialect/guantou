import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/guantou', () => ({
  getCircle: vi.fn(),
  joinCircle: vi.fn(),
  leaveCircle: vi.fn(),
  listCircleCans: vi.fn(),
  listCircles: vi.fn(),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));

import CircleDetails from '@/pages/circles/details.vue';
import CircleIndex from '@/pages/circles/index.vue';
import { requireAuth } from '@/services/authGuard';
import {
  getCircle, joinCircle, listCircleCans, listCircles,
} from '@/services/guantou';

const circle = {
  id: 4,
  name: '闽语圈',
  description: '一起记录闽语乡音',
  dialect: { id: 2, name: '闽语' },
  is_member: false,
  member_count: 3,
  can_count: 8,
};

function stubs() {
  return {
    CanList: { template: '<div class="can-list" />' },
    EmptyState: true,
    PageShell: { template: '<main><slot /></main>' },
  };
}

describe('dialect circles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCircle.mockResolvedValue(circle);
    joinCircle.mockResolvedValue({ changed: true, is_member: true, member_count: 4 });
    listCircles.mockResolvedValue({ results: [circle] });
    listCircleCans.mockResolvedValue({ results: [], next: null });
    requireAuth.mockReturnValue(true);
    globalThis.uni = { navigateTo: vi.fn() };
  });

  it('lists circles and updates membership without mutating the source item', async () => {
    const wrapper = mount(CircleIndex, { global: { stubs: stubs() } });
    await wrapper.vm.refresh();
    await wrapper.vm.toggleMembership(wrapper.vm.circles[0]);
    await flushPromises();

    expect(joinCircle).toHaveBeenCalledWith(4);
    expect(wrapper.vm.circles[0].is_member).toBe(true);
    expect(circle.is_member).toBe(false);
  });

  it('opens can creation with the circle dialect preselected', async () => {
    const wrapper = mount(CircleDetails, { global: { stubs: stubs() } });
    wrapper.vm.circleId = 4;
    await wrapper.vm.loadCircle();

    wrapper.vm.recordHere();

    expect(requireAuth).toHaveBeenCalledWith('record_can', {
      page: 'circle_detail',
      circleId: 4,
      dialectId: 2,
    });
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/cans/create?dialect=2',
    });
  });
});
