import { expect, test } from '@playwright/test';

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
    body: await page.screenshot({ fullPage: true }),
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
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('legacy native inputs keep a non-zero text area until migration', async ({ page }) => {
  await page.goto('/pages/cans/create');

  const legacyInput = page.locator('input:not(.t-input__control)').first();
  await expect(legacyInput).toBeVisible();
  const legacyInputBox = await rect(legacyInput);

  expect(legacyInputBox.height).toBeGreaterThan(20);
});

test('PageShell and AppShell mount the shared feedback host', async ({ page }) => {
  await page.goto('/pages/mails/send');
  await expect(page.locator('.feedback-host')).toHaveCount(1);

  await page.goto('/pages/shelves/index');
  await expect(page.locator('.feedback-host')).toHaveCount(1);
});

test('the migrated not-found empty state renders its copy once', async ({ page }) => {
  await page.goto('/pages/error/not-found');

  await expect(page.getByText('您访问的页面不存在，请检查链接是否正确。')).toHaveCount(1);
  await expect(page.locator('[aria-label="返回首页"]')).toBeVisible();
});
