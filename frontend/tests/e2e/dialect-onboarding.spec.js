import { expect, test } from '@playwright/test';

const dialect = {
  id: 3,
  name: '四川话',
  code: '四川',
  qualified_code: '西南官话.四川',
  parent: null,
  sort_order: 1,
};

test('new user selects a primary dialect and reaches home', async ({ page }) => {
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
  await page.route('**/users/7', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        json: {
          token: 'profile-token',
          user: {
            id: 7,
            username: 'collector',
            nickname: '采集者',
            primary_dialect: dialect,
          },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'collector',
          nickname: '采集者',
          primary_dialect: null,
        },
        contribution: {},
      },
    });
  });
  await page.route('**/dialects/**', async (route) => {
    const url = new URL(route.request().url());
    const isChildRequest = url.searchParams.has('parent_id');
    await route.fulfill({
      json: {
        count: isChildRequest ? 0 : 1,
        next: null,
        previous: null,
        results: isChildRequest ? [] : [dialect],
      },
    });
  });
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
          primary_nameplate: { display_text: '巴适' },
          duration_ms: 3200,
        }],
      },
    });
  });
  await page.route('**/users/recommendations**', async (route) => {
    await route.fulfill({
      json: {
        results: [],
      },
    });
  });

  await page.goto('/pages/users/onboarding?reason=new_user');
  await expect(page.getByText('欢迎加入乡声集盒')).toBeVisible();
  await page.locator('.nickname-input input, input.nickname-input').fill('采集者');
  await page.locator('.base-button').filter({ hasText: '下一步 · 选主方言' }).click();
  await page.locator('.base-button').filter({ hasText: '逐级选择主方言' }).click();
  await page.locator('.dialect-selector__node').filter({ hasText: '四川话' }).click();
  await expect(page.getByText('巴适')).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/dialect-onboarding.png`,
      fullPage: true,
    });
  }
  await page.locator('.base-button').filter({ hasText: '完成设置' }).click();

  await expect(page).toHaveURL(/\/pages\/users\/recommend-follow$/);
  await expect(page.getByText('暂时没有可推荐的同方言作者')).toBeVisible();
  await page.locator('.base-button').filter({ hasText: '暂时跳过' }).click();

  await expect(page).toHaveURL(/\/$/);
  /* 新首页品牌小标：「乡声集盒 · 把乡音装进罐头」 */
  await expect(page.locator('.home-top-bar__brand')).toContainText('乡声集盒');
});
