import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/entryRecording', () => ({
  createCurationAction: vi.fn(),
  createCuratorApplication: vi.fn(),
  getCurationSummary: vi.fn(),
  getMyContributionHistory: vi.fn(),
  listCurationTasks: vi.fn(),
  listCuratorApplications: vi.fn(),
  listCuratorGrants: vi.fn(),
  pageResults: (response) => response?.results || response || [],
  withdrawCuratorApplication: vi.fn(),
}));
vi.mock('@/services/guantou', () => ({ listAllDialects: vi.fn() }));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/services/navigation', async (importOriginal) => ({
  ...(await importOriginal()),
  goRecord: vi.fn(),
}));

const governance = await import('@/services/entryRecording');
const { listAllDialects } = await import('@/services/guantou');
const { default: ApplyPage } = await import('@/pages/curation/apply.vue');
const { default: WorkbenchPage } = await import('@/pages/curation/index.vue');
const { default: ContributionsPage } = await import('@/pages/users/contributions.vue');

const stubs = {
  PageShell: { template: '<main><slot /></main>' },
  BaseButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  BaseField: { template: '<label><slot /></label>' },
  BaseForm: { template: '<form><slot /></form>' },
  DialectSelector: true,
  DialectLabel: true,
  EmptyState: true,
};

function mountPage(component) {
  return mount(component, { global: { stubs } });
}

describe('V2 governance journeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: {} } }));
    governance.listCuratorApplications.mockResolvedValue({ results: [] });
    governance.listCuratorGrants.mockResolvedValue({ results: [] });
    governance.listCurationTasks.mockResolvedValue({ results: [] });
    governance.getCurationSummary.mockResolvedValue({ grants: [], pending: {} });
    governance.getMyContributionHistory.mockResolvedValue({
      summary: { recordings: 2, evidence: 1, revisions: 3, dialects: 1 },
      dialect_footprint: [],
      recent_activity: [],
    });
    listAllDialects.mockResolvedValue([{
      id: 8,
      name: '莆仙方言',
      qualified_code: 'min.puxian',
      path_names: ['闽语', '莆仙方言'],
    }]);
  });

  it('submits a regional curator application with an explicit scope', async () => {
    governance.createCuratorApplication.mockResolvedValue({ id: 4 });
    const wrapper = mountPage(ApplyPage);
    await wrapper.vm.load();
    wrapper.vm.form.dialect_id = 8;
    wrapper.vm.form.statement = '我从小使用莆仙方言，能够核对城乡地区发音与实际使用范围。';

    await wrapper.vm.submit();

    expect(governance.createCuratorApplication).toHaveBeenCalledWith({
      role: 'regional_curator',
      dialect_id: 8,
      statement: '我从小使用莆仙方言，能够核对城乡地区发音与实际使用范围。',
      experience: '',
    });
  });

  it('keeps reviewed applications and their reasons visible', async () => {
    governance.listCuratorApplications.mockResolvedValue({
      results: [{
        id: 3,
        role: 'lexical_curator',
        status: 'rejected',
        review_reason: '请先补充可核对的资料来源。',
      }],
    });
    const wrapper = mountPage(ApplyPage);

    await wrapper.vm.load();

    expect(wrapper.vm.resolvedApplications).toHaveLength(1);
    expect(wrapper.vm.statusLabel('rejected')).toBe('未通过');
    expect(wrapper.text()).toContain('请先补充可核对的资料来源');
  });

  it('turns a scoped workbench decision into an auditable action', async () => {
    const task = {
      kind: 'recording', id: 6, target_type: 'recording', title: '表示害怕',
      summary: '核对地区范围', actions: ['published', 'disputed', 'rejected'],
    };
    governance.listCurationTasks.mockResolvedValue({ results: [task] });
    governance.createCurationAction.mockResolvedValue({ id: 12 });
    const wrapper = mountPage(WorkbenchPage);
    await wrapper.vm.load();
    wrapper.vm.choose(task, 'disputed');
    wrapper.vm.reason = '现有证据不足，先并列保留解释。';

    await wrapper.vm.submit(task);

    expect(governance.createCurationAction).toHaveBeenCalledWith({
      action_type: 'review',
      target_type: 'recording',
      target_id: 6,
      reason: '现有证据不足，先并列保留解释。',
      changes: { status: 'disputed' },
    });
  });

  it('shows contribution categories without scores or authority ranks', async () => {
    const wrapper = mountPage(ContributionsPage);
    await wrapper.vm.load();

    expect(wrapper.vm.metrics.map((item) => item.label)).toEqual([
      '录音', '补证', '修订', '地区足迹',
    ]);
    expect(wrapper.text()).not.toContain('积分');
    expect(wrapper.text()).not.toContain('权威等级');
  });
});
