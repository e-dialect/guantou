import { expect, test } from '@playwright/test';

const enabledCapabilities = {
  listen_feed: true,
  entry_search: true,
  recording: true,
  usage_attestation: true,
  curation_workbench: true,
  wechat_auth: true,
};

async function routeCapabilities(page, overrides = {}) {
  await page.route('**/site-settings/capabilities', async (route) => {
    await route.fulfill({
      json: {
        version: 1,
        capabilities: { ...enabledCapabilities, ...overrides },
        updated_at: '2026-09-05T00:00:00Z',
        cache_seconds: 300,
      },
    });
  });
}

test('a remotely disabled recording flow explains the degradation', async ({ page }) => {
  await routeCapabilities(page, { recording: false });
  await page.route('**/product-events/', async (route) => {
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });

  await page.goto('/pages/recordings/create');

  await expect(page.getByText('录音提交正在维护')).toBeVisible();
  await expect(page.getByText('应用不会读取或保存设备位置')).toBeVisible();
  await expect(page.getByText('保存这段乡音')).toHaveCount(0);
});

test('entry search reports only a result bucket and filter count', async ({ page }) => {
  await routeCapabilities(page);
  const productEvents = [];
  await page.route('**/product-events/', async (route) => {
    productEvents.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });
  await page.route(/\/entries\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 7,
          display_writing: '行',
          summary: '步行、行走',
          status: 'reviewed',
          recording_count: 1,
          needs_audio: false,
          usage_dialect: { id: 3, name: '莆仙方言' },
        }],
      },
    });
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({ json: { count: 0, results: [] } });
  });

  await page.goto('/pages/search?keywords=%E8%A1%8C');
  await expect(page.getByText('步行、行走')).toBeVisible();
  await expect.poll(() => productEvents.some((event) => event.event_name === 'entry_search'))
    .toBe(true);

  const searchEvent = productEvents.find((event) => event.event_name === 'entry_search');
  expect(searchEvent.metadata).toEqual({ result_bucket: '1-5', filter_count: 0 });
  expect(JSON.stringify(searchEvent)).not.toContain('步行');
  expect(JSON.stringify(searchEvent)).not.toContain('莆仙');
  expect(searchEvent).not.toHaveProperty('user_id');
});
