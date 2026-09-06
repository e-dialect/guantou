import { expect, test } from '@playwright/test';

test('an unknown H5 URL reaches the recovery page without console noise', async ({ page }) => {
  const consoleProblems = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleProblems.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const attemptedPath = '/missing/shared/dialect/a-very-long-unavailable-path';
  await page.goto(`${attemptedPath}?token=private-value`);

  await expect(page).toHaveURL(/pages\/error\/not-found/);
  expect(page.url()).not.toContain('private-value');
  await expect(page.getByText(attemptedPath, { exact: true })).toBeVisible();
  await expect(page.getByText('private-value')).toHaveCount(0);
  const recoveryAction = page.locator('[aria-label="返回首页"]');
  await expect(recoveryAction).toBeVisible();

  await recoveryAction.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');

  expect(consoleProblems).toEqual([]);
  expect(pageErrors).toEqual([]);
});
