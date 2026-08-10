import { expect, test } from '@playwright/test';

test('guest signs in with the visible demo phone code', async ({ page }) => {
  await page.goto('/');
  await page.locator('.quick-card.mine').click();
  await expect(page.getByText('还没有登录')).toBeVisible();
  await page.locator('.login-button').click();

  const phoneInputs = page.locator('.phone-form input.uni-input-input');
  const phone = phoneInputs.nth(0);
  const code = phoneInputs.nth(1);
  await expect(phone).toBeVisible();
  await phone.fill('13800001234');
  await page.getByText('获取验证码', { exact: true }).click();

  const codeHint = page.locator('.demo-code');
  await expect(codeHint).toContainText('Demo 验证码：');
  const codeValue = (await codeHint.textContent()).match(/\d{6}/)[0];
  await code.fill(codeValue);
  await page.getByText('登录 / 注册', { exact: true }).click();

  await expect(page).toHaveURL(/\/pages\/users\/onboarding\?reason=new_user/);
  await expect(page.getByText('欢迎加入乡声集盒')).toBeVisible();
  const session = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    id: localStorage.getItem('id'),
  }));
  expect(session.token).toBeTruthy();
  expect(session.id).toBeTruthy();
});
