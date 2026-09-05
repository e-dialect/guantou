import { expect, test } from '@playwright/test';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';
import { stableScreenshot } from './helpers/stableScreenshot';

const TARGET = '/pages/users/settings/information';
const SETTINGS = ['用户名', '昵称', '邮箱', '手机', '生日', '发音默认地点'];
const VIEWPORTS = [
  {
    name: 'portrait-light', width: 390, height: 844, theme: 'light',
  },
  {
    name: 'portrait-dark', width: 390, height: 844, theme: 'dark',
  },
  {
    name: 'landscape-light', width: 844, height: 390, theme: 'light',
  },
  {
    name: 'tablet-light', width: 768, height: 1024, theme: 'light',
  },
  {
    name: 'desktop-dark', width: 1440, height: 900, theme: 'dark',
  },
];

function cell(page, title) {
  return page.locator('.profile-form .t-cell').filter({
    has: page.getByText(title, { exact: true }),
  });
}

async function expectSettingRoute(page, title, path, keyboard = false) {
  if (keyboard) {
    await cell(page, title).focus();
    await cell(page, title).press('Enter');
  } else {
    await cell(page, title).click();
  }
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.getByRole('button', { name: '返回' }).click();
  await expect(page.getByText('编辑资料').first()).toBeVisible();
}

VIEWPORTS.forEach((viewport) => {
  test(`profile setting cells stay discoverable in ${viewport.name}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installVisualFixture(page, { persona: 'member', theme: viewport.theme });
    await openVisualRoute(page, TARGET, { persona: 'member' });

    const cells = page.locator('.profile-form .t-cell');
    await expect(cells).toHaveCount(SETTINGS.length);
    await expect(page.locator('.profile-form .t-cell__right-icon')).toHaveCount(SETTINGS.length);
    await expect(cells.locator('.t-cell__title-text')).toHaveText(SETTINGS);
    await expect(page.getByRole('button', {
      name: '修改用户名，当前为visual-reviewer',
    })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);

    await stableScreenshot(page, {
      path: `test-results/profile-settings-cells-${viewport.name}.png`,
    });
    expect(runtimeIssues, `${viewport.name} browser console`).toEqual([]);
  });
});

test('profile setting cells preserve routes, pickers, and long values', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, { persona: 'member' });
  await page.route('http://localhost:8000/users/7', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'a-very-long-public-username-without-breaks-2026',
          nickname: '视觉巡检员',
          avatar: '',
          email: 'long-address-for-layout-regression@example.com',
          telephone: '13900000001',
          birthday: '1991-02-03',
          primary_dialect: {
            id: 3,
            name: '莆仙方言',
            qualified_code: '闽.莆仙',
            path_names: ['闽语', '莆仙方言'],
          },
        },
      },
    });
  });
  await openVisualRoute(page, TARGET, { persona: 'member' });

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  const longNoteLayouts = await Promise.all([
    cell(page, '用户名').locator('.t-cell__note'),
    cell(page, '邮箱').locator('.t-cell__note'),
  ].map((note) => note.evaluate((element) => {
    const noteRect = element.getBoundingClientRect();
    const cellRect = element.closest('.t-cell').getBoundingClientRect();
    return {
      bottom: noteRect.bottom,
      cellBottom: cellRect.bottom,
      cellRight: cellRect.right,
      height: noteRect.height,
      right: noteRect.right,
    };
  })));
  longNoteLayouts.forEach((layout) => {
    expect(layout.height).toBeGreaterThan(24);
    expect(layout.right).toBeLessThanOrEqual(layout.cellRight);
    expect(layout.bottom).toBeLessThanOrEqual(layout.cellBottom);
  });
  await expectSettingRoute(page, '用户名', '/pages/users/settings/username', true);
  await expectSettingRoute(page, '昵称', '/pages/users/settings/nickname');
  await expectSettingRoute(page, '邮箱', '/pages/users/settings/email');
  await expectSettingRoute(page, '手机', '/pages/users/settings/telephone');

  await cell(page, '生日').click();
  await expect(page.getByText('确定').first()).toBeVisible();
  await page.getByText('取消').last().click();

  await cell(page, '发音默认地点').click();
  await expect(page.getByRole('dialog', { name: '发音默认地点' })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  expect(runtimeIssues, 'profile setting interactions browser console').toEqual([]);
});
