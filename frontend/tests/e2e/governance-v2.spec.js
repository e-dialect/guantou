import { expect, test } from '@playwright/test';

async function signedIn(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'curator-token');
    localStorage.setItem('id', '7');
  });
}

test('ordinary contributor can prepare a scoped curator application', async ({ page }) => {
  await signedIn(page);
  await page.route('**/curator-applications/**', async (route) => {
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
  await page.route('**/curator-grants/**', async (route) => {
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 3,
          name: '莆仙方言',
          qualified_code: 'min.puxian',
          path_names: ['闽语', '莆仙方言'],
          sort_order: 1,
        }],
      },
    });
  });

  await page.goto('/pages/curation/apply');

  await expect(page.getByText('申请成为整理员').first()).toBeVisible();
  await expect(page.getByText('共同整理，不争权威')).toBeVisible();
  await expect(page.getByRole('button', { name: '词条整理' })).toBeVisible();
  await expect(page.getByRole('button', { name: '地区整理' })).toBeVisible();
  await expect(page.getByText('逐级选择地区范围')).toBeVisible();
  await expect(page.getByText('公开授权记录')).toBeVisible();
});

test('authorized curator can record a scoped decision and view history', async ({ page }) => {
  await signedIn(page);
  const actions = [];
  await page.route('**/curation/', async (route) => {
    await route.fulfill({
      json: {
        grants: [{
          id: 1,
          role: 'regional_curator',
          dialect: { id: 3, name: '莆仙方言', path_names: ['闽语', '莆仙方言'] },
        }],
        pending: { recordings: 1 },
      },
    });
  });
  await page.route('**/curation/tasks/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        results: [{
          kind: 'recording',
          id: 6,
          title: '表示害怕',
          summary: '核对地区范围、原始大意与授权',
          target_type: 'recording',
          dialect: { id: 3, name: '莆仙方言', path_names: ['闽语', '莆仙方言'] },
          actions: ['published', 'disputed', 'rejected'],
        }],
      },
    });
  });
  await page.route('**/curation/actions/**', async (route) => {
    actions.push(route.request().postDataJSON());
    await route.fulfill({ json: { id: 12 } });
  });
  await page.route('**/contributions/me/**', async (route) => {
    await route.fulfill({
      json: {
        summary: { recordings: 2, evidence: 1, revisions: 3, dialects: 1 },
        dialect_footprint: [],
        recent_activity: [],
      },
    });
  });

  await page.goto('/pages/curation/index');
  await expect(page.getByText('表示害怕')).toBeVisible();
  await page.getByText('保留争议').click();
  await page.locator('.task textarea').fill('现有证据不足，先保留不同解释。');
  await page.getByText('确认保留争议').click();
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toMatchObject({
    action_type: 'review',
    target_type: 'recording',
    target_id: 6,
    changes: { status: 'disputed' },
  });

  await page.goto('/pages/users/contributions');
  await expect(page.getByText('记录你留下了什么，不给人排权威高低')).toBeVisible();
  await expect(page.getByText('2')).toBeVisible();
  await expect(page.getByText('积分')).toHaveCount(0);
});
