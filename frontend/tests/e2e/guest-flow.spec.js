import { expect, test } from '@playwright/test';

test('guest browses public cans, plays audio, and opens search', async ({ page }) => {
  await page.route('**/cans/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 11,
          audio_url: 'https://example.com/sample.mp3',
          concept_text: '舒服',
          duration_ms: 3200,
          nameplate_count: 1,
          primary_nameplate: { display_text: '巴适' },
          status: 'verified',
          submitted_dialect: { qualified_code: '西南官话.四川' },
          views: 8,
        }],
      },
    });
  });

  await page.goto('/');
  await expect(page.getByText('不登录也能查、能听')).toBeVisible();
  await expect(page.getByText('公开乡音')).toBeVisible();
  await expect(page.getByText('巴适')).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/guest-home.png`,
    });
  }

  await page.locator('.play-button').click();
  await expect(page.getByText('正在播放...')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.getByText('去查词').click();
  await expect(page).toHaveURL(/\/pages\/search$/);
  await expect(page.getByRole('searchbox')).toBeVisible();
});
