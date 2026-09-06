import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const TARGET = '/pages/users/me';
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

async function openGuestAccount(page, theme = 'light') {
  await installVisualFixture(page, { persona: 'guest', theme });
  await openVisualRoute(page, TARGET, { persona: 'guest' });
  await expect(page.getByText('还没有登录 · 也可以先逛')).toBeVisible();
}

VIEWPORTS.forEach((viewport) => {
  test(`guest account actions stay coherent in ${viewport.name}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openGuestAccount(page, viewport.theme);

    await expect(page.getByRole('button', { name: '登录或创建账户' })).toHaveCount(1);
    await expect(page.locator('.guest-shortcuts .t-cell')).toHaveCount(2);
    await expect(page.locator('.guest-theme .t-cell')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '先去听乡音' })).toBeVisible();
    await expect(page.getByRole('button', { name: '先去查词条' })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开主题中心，当前 默认方言主题' })).toBeVisible();

    const actionRegion = page.locator('.guest-shortcuts, .guest-theme');
    const cells = await actionRegion.locator('.t-cell').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }));
    expect(cells).toHaveLength(3);
    cells.forEach(({ height, width }) => {
      expect(height).toBeGreaterThanOrEqual(44);
      expect(width).toBeGreaterThan(120);
    });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);

    await page.locator('.guest-theme').evaluate((element) => element.scrollIntoView({
      behavior: 'instant',
      block: 'center',
      inline: 'nearest',
    }));
    await stableScreenshot(page, {
      path: `test-results/guest-account-actions-${viewport.name}.png`,
    });
    expect(runtimeIssues, `${viewport.name} browser console`).toEqual([]);
  });
});

test('guest account keeps keyboard access to all three secondary destinations', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await openGuestAccount(page);

  const listen = page.getByRole('button', { name: '先去听乡音' });
  await listen.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);

  await openGuestAccount(page);
  const search = page.getByRole('button', { name: '先去查词条' });
  await search.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/pages\/search$/);

  await openGuestAccount(page);
  const themes = page.getByRole('button', { name: '打开主题中心，当前 默认方言主题' });
  await themes.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pages\/users\/theme-center$/);
  expect(runtimeIssues, 'guest account interactions browser console').toEqual([]);
});
