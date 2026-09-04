import { expect, test } from '@playwright/test';

async function openMine(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('还没有登录')).toBeVisible();
}

async function themeTokens(page) {
  return page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.theme || '',
      page: styles.getPropertyValue('--page-color').trim(),
      text: styles.getPropertyValue('--text-color').trim(),
      surface: styles.getPropertyValue('--surface-color').trim(),
    };
  });
}

test('mine page keeps contrast in light and dark themes', async ({ page }) => {
  await openMine(page);

  const light = await themeTokens(page);
  expect(light.page).toBe('#f6f7f3');
  expect(light.text).toBe('#1d2a24');
  expect(light.page).not.toBe(light.text);
  await page.screenshot({
    path: 'test-results/account-me-light.png',
    fullPage: true,
  });

  await page.locator('.theme-option', { hasText: '深色' }).click();
  await expect.poll(async () => (await themeTokens(page)).theme).toBe('dark');

  const dark = await themeTokens(page);
  expect(dark.page).toBe('#121915');
  expect(dark.text).toBe('#edf4ef');
  expect(dark.surface).toBe('#1d2822');
  expect(dark.page).not.toBe(light.page);
  await page.screenshot({
    path: 'test-results/account-me-dark.png',
    fullPage: true,
  });
});

test('account settings stay behind login and use PageShell titles', async ({ page }) => {
  await openMine(page);
  await page.locator('.login-button').click();
  await expect(page.getByText('登录后可以支持铭牌')).toBeVisible();

  await page.goto('/pages/users/settings/information');
  await expect(page).toHaveURL(/\/pages\/login\/login/);

  await page.goto('/pages/users/settings/password');
  await expect(page).toHaveURL(/\/pages\/login\/login/);
});

async function mockSignedInCollector(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('id', '7');
  });
  await page.route('**/login', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { token: 'fresh-token', id: 7 } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/7/email', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { user: { id: 7, email: 'new@example.com' } } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/email-code', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { retry_after: 60 } });
      return;
    }
    await route.continue();
  });
  await page.route('**/users/7/password', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { user: { id: 7 }, token: 'fresh-token' } });
      return;
    }
    await route.continue();
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 3,
          name: '四川话',
          qualified_code: '西南官话.四川',
          sort_order: 1,
        }],
      },
    });
  });
  await page.route('**/users/7', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'collector',
          nickname: '采集者',
          email: 'c@example.com',
          telephone: '13900000001',
          birthday: '1991-02-03',
          wechat: false,
          primary_dialect: { id: 3, name: '四川话', qualified_code: '西南官话.四川' },
        },
        contribution: {},
      },
    });
  });
}

test('H5 mine account menu hides WeChat bind and keeps email', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/me');

  await expect(page.getByText('账号与安全')).toBeVisible();
  await expect(page.getByText('邮箱')).toBeVisible();
  await expect(page.getByText('修改密码')).toBeVisible();
  await expect(page.getByText('绑定微信')).toHaveCount(0);
  await expect(page.getByText('点此授权')).toHaveCount(0);
});

test('password settings use design-system fields, visibility, and loading', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/password');

  await expect(page.getByText('修改密码').first()).toBeVisible();
  await expect(page.getByText('原密码').first()).toBeVisible();
  await expect(page.getByText('新密码').first()).toBeVisible();
  await expect(page.getByText('确认密码')).toBeVisible();
  await expect(page.locator('form:not(.t-form)')).toHaveCount(0);

  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('请输入原密码')).toBeVisible();

  const oldInput = page.locator('input').first();
  await expect(oldInput).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: '显示' }).first().click();
  await expect(oldInput).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: '隐藏' }).click();
  await expect(oldInput).toHaveAttribute('type', 'password');

  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-password-light.png`,
      fullPage: true,
    });
  }

  const inputs = page.locator('input');
  await inputs.nth(0).fill('old-pass');
  await inputs.nth(1).fill('new-pass');
  await inputs.nth(2).fill('new-pass');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('修改成功')).toBeVisible();
});

test('H5 nickname page hides WeChat nickname fill', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/nickname');

  await expect(page.getByText('修改昵称').first()).toBeVisible();
  await expect(page.getByText('点这里填入微信昵称')).toHaveCount(0);
  await expect(page.getByText('也可以点下方授权')).toHaveCount(0);
});

test('information settings replace native pickers and open the avatar sheet', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/information');

  await expect(page.getByText('编辑资料').first()).toBeVisible();
  await expect(page.getByText('公开档案')).toBeVisible();
  await expect(page.getByText('仅自己可见')).toBeVisible();
  await expect(page.getByText('发音默认地点')).toBeVisible();
  await expect(page.getByText('西南官话.四川')).toBeVisible();
  await expect(page.locator('picker')).toHaveCount(0);

  await page.locator('.avatar-hit').click();
  await expect(page.locator('.sheet-item', { hasText: '从相册选择' })).toBeVisible();
  await expect(page.locator('.sheet-item', { hasText: '拍照' })).toBeVisible();
  await expect(page.getByText('使用微信头像')).toHaveCount(0);
  await expect(page.getByText('从聊天记录选择')).toHaveCount(0);
  await expect(page.getByText('微信头像和聊天记录需要在小程序里使用')).toHaveCount(0);

  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-information-light.png`,
      fullPage: true,
    });
  }

  await page.getByText('取消').click();
  await page.getByText('生日').click();
  await expect(page.getByText('确定').first()).toBeVisible();
});

test('email settings send a bind code without native form controls', async ({ page }) => {
  await mockSignedInCollector(page);
  await page.goto('/pages/users/settings/email');

  await expect(page.getByText('修改邮箱').first()).toBeVisible();
  await expect(page.getByText('原邮箱')).toBeVisible();
  await expect(page.getByText('c@example.com')).toBeVisible();
  await expect(page.getByText('获取验证码')).toBeVisible();
  await expect(page.locator('form:not(.t-form)')).toHaveCount(0);

  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('请输入新邮箱')).toBeVisible();

  const inputs = page.locator('input');
  await inputs.nth(1).fill('new@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText('验证码已发送')).toBeVisible();
  await expect(page.getByRole('button', { name: /后重发/ })).toBeDisabled();

  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/account-email-light.png`,
      fullPage: true,
    });
  }
});
