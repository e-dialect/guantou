import { expect, test } from '@playwright/test';

test('guest can cancel an intercepted action and return to search', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_intercept_intent', JSON.stringify({
      version: 1,
      action: 'record_recording',
      context: { entryId: 9, page: 'entry_detail' },
      createdAt: Date.now(),
      voluntary: false,
    }));
  });

  await page.goto('/pages/login/login');
  await expect(page.getByText('你刚才想录制乡音，验证身份后会回到原来的位置。')).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/auth-intent.png`,
      fullPage: true,
    });
  }

  await page.getByText('暂不登录，先去查词').click();

  await expect(page).toHaveURL(/\/pages\/search$/);
  await expect(page.locator('.entry-search__bar input')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
});
