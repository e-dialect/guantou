import { expect, test } from '@playwright/test';

test('H5 app renders home page', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByText('乡声集盒').first()).toBeVisible();
  await expect(page.getByText('装罐').first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('frontend nginx proxies site settings API', async ({ request }) => {
  const response = await request.get('/api/site-settings/carousel');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.carousel)).toBe(true);
});

test('protected APIs remain protected through frontend proxy', async ({ request }) => {
  const files = await request.get('/api/files');
  expect(files.status()).toBe(401);

  const notifications = await request.get('/api/notifications');
  expect(notifications.status()).toBe(401);
});

test('main navigation pages are reachable', async ({ page }) => {
  await page.goto('/pages/cans/index');
  await expect(page.locator('body')).toContainText('罐头');

  await page.goto('/pages/flavors/index');
  await expect(page.locator('body')).toContainText('图鉴');
});
