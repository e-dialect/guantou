import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';

const rect = (locator) => locator.evaluate((element) => {
  const { width, height } = element.getBoundingClientRect();
  return { width, height };
});

test('BaseField stays readable and full width on a 390px mobile viewport', async ({ page }, testInfo) => {
  await page.goto('/pages/mails/send');

  const labels = page.locator('.t-form__label');
  await expect(labels).toHaveCount(3);
  await expect(labels.nth(0)).toContainText('接收者 ID');

  const inputBox = await rect(page.locator('.t-input').first());
  const nativeInputBox = await rect(page.locator('.t-input__control').first());
  const textareaBox = await rect(page.locator('.t-textarea'));
  const nativeTextareaBox = await rect(page.locator('.t-textarea__wrapper-inner'));

  expect(inputBox.width).toBeGreaterThan(300);
  expect(inputBox.height).toBeGreaterThan(40);
  expect(nativeInputBox.height).toBeGreaterThan(20);
  expect(textareaBox.width).toBeGreaterThan(300);
  expect(textareaBox.height).toBeGreaterThan(120);
  expect(nativeTextareaBox.height).toBeGreaterThanOrEqual(80);

  await page.locator('[aria-label="提交"]').click();
  await expect(page.locator('.t-form__item-extra')).toHaveCount(3);

  await testInfo.attach('mail-form-light-390x844', {
    body: await stableScreenshot(page, { fullPage: true }),
    contentType: 'image/png',
  });
});

test('TDesign theme bridge supplies readable dark form colors', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/pages/mails/send');

  const colors = await page.locator('.t-input').first().evaluate((element) => {
    const style = getComputedStyle(element);
    const inputStyle = getComputedStyle(element.querySelector('.t-input__control'));
    return {
      background: style.backgroundColor,
      text: inputStyle.color,
    };
  });

  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.text).not.toBe(colors.background);

  await testInfo.attach('mail-form-dark-390x844', {
    body: await stableScreenshot(page, { fullPage: true }),
    contentType: 'image/png',
  });
});

test('component-level theme-dark recomputes TDesign tokens', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/pages/mails/send');

  const shell = page.locator('.page-shell');
  await expect(shell).toHaveClass(/theme-light/);
  await shell.evaluate((element) => {
    element.classList.remove('theme-light');
    element.classList.add('theme-dark');
  });

  const colors = await page.locator('.t-input').first().evaluate((element) => {
    const style = getComputedStyle(element);
    const inputStyle = getComputedStyle(element.querySelector('.t-input__control'));
    return {
      background: style.backgroundColor,
      text: inputStyle.color,
    };
  });

  expect(colors.background).toBe('rgb(29, 40, 34)');
  expect(colors.text).toBe('rgb(237, 244, 239)');
});

test('recording creation uses a BaseField with a non-zero text area', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-layout-token');
    localStorage.setItem('id', '1');
  });
  await page.goto('/pages/recordings/create');

  const conceptInput = page.locator('.base-field input').first();
  await expect(conceptInput).toBeVisible();
  const conceptInputBox = await rect(conceptInput);

  expect(conceptInputBox.height).toBeGreaterThan(20);
});

test('PageShell and AppShell mount the shared feedback host', async ({ page }) => {
  await page.goto('/pages/mails/send');
  await expect(page.locator('.feedback-host')).toHaveCount(1);

  await page.goto('/pages/users/bookmarks');
  await expect(page.locator('.feedback-host')).toHaveCount(1);
});

test('the not-found page explains the attempted path and offers one recovery route', async ({ page }) => {
  const attemptedPath = '/shared/dialect/entry/a-very-long-and-unavailable-route';
  await page.goto(`${attemptedPath}?token=private-value`);

  await expect(page).toHaveURL(/pages\/error\/not-found/);
  await expect(page.getByText('这条路没有找到页面')).toHaveCount(1);
  await expect(page.getByText(attemptedPath, { exact: true })).toBeVisible();
  await expect(page.getByText('private-value')).toHaveCount(0);

  const recoveryAction = page.locator('[aria-label="返回首页"]');
  await expect(recoveryAction).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(1);
  await recoveryAction.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
});
