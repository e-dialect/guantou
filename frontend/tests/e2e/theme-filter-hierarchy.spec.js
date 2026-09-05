import { expect, test } from '@playwright/test';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';
import { stableScreenshot } from './helpers/stableScreenshot';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

async function openThemeCenter(page, theme = 'light') {
  await installVisualFixture(page, { persona: 'member', theme });
  await openVisualRoute(page, '/pages/users/theme-center', { persona: 'member' });
  await expect(page.locator('.theme-grid')).toBeVisible();
}

test('theme center exposes one contextual filter path', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await openThemeCenter(page);

  const filterAction = page.getByRole('button', { name: /筛选与排序/ });
  await expect(filterAction).toHaveCount(1);
  await expect(filterAction).toContainText('最新上架');
  await expect(filterAction.locator('.t-cell__right-icon')).toBeVisible();
  const filterBox = await filterAction.boundingBox();
  expect(filterBox?.height || 0).toBeGreaterThanOrEqual(44);
  await stableScreenshot(page, {
    path: 'test-results/theme-filter-summary-cell-390x844-light.png',
  });
  await expect(page.locator('.theme-center-page .filter-scroll')).toHaveCount(1);
  const gridTop = await page.locator('.theme-grid').evaluate((node) => (
    node.getBoundingClientRect().top + window.scrollY
  ));
  expect(gridTop).toBeLessThanOrEqual(646);

  await filterAction.focus();
  await page.keyboard.press('Enter');
  const filter = page.locator('.filter-sheet');
  await expect(filter.getByText('全局主题筛选', { exact: true })).toBeVisible();
  await expect(filter.getByText('风格分类', { exact: true })).toBeVisible();
  await expect(filter.getByText('地域方言标签', { exact: true })).toBeVisible();
  await expect(filter.getByText('装扮组件', { exact: true })).toHaveCount(0);
  await filter.getByText('地域方言风', { exact: true }).click();
  await filter.getByText('热度最高', { exact: true }).click();
  await filter.getByRole('button', { name: '确定' }).click();
  await expect(page.locator('.filter-toolbar')).toContainText('地域方言风');
  await expect(page.locator('.filter-toolbar')).toContainText('热度最高');
  await expect(filterAction.locator('.t-cell__note')).toHaveCSS('overflow', 'hidden');

  await page.locator('.tab', { hasText: '局部装扮' }).click();
  await expect(page.locator('.theme-center-page .filter-scroll')).toHaveCount(1);
  await filterAction.click();
  await expect(filter.getByText('局部装扮筛选', { exact: true })).toBeVisible();
  await expect(filter.getByText('装扮组件', { exact: true })).toBeVisible();
  await expect(filter.getByText('风格分类', { exact: true })).toHaveCount(0);
  await expect(filter.getByText('地域方言标签', { exact: true })).toHaveCount(0);
  await filter.getByText('录音卡片', { exact: true }).click();
  await filter.getByRole('button', { name: '确定' }).click();
  await expect(page.locator('.filter-toolbar')).toContainText('录音卡片');

  await page.locator('.hot-scroll .chip', { hasText: '川渝烟火' }).click();
  await filterAction.focus();
  await page.keyboard.press('Space');
  await expect(filter.getByText('搜索筛选与排序', { exact: true })).toBeVisible();
  await expect(filter.getByText('风格分类', { exact: true })).toBeVisible();
  await expect(filter.getByText('装扮组件', { exact: true })).toBeVisible();
  await filter.getByRole('button', { name: '确定' }).click();

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  expect(runtimeIssues).toEqual([]);
});

VIEWPORTS.forEach((viewport) => {
  test(`compact filter hierarchy holds at ${viewport.width}x${viewport.height} in dark mode`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await openThemeCenter(page, 'dark');
    await page.setViewportSize(viewport);
    const filterAction = page.getByRole('button', { name: /筛选与排序/ });
    await expect(filterAction).toHaveCount(1);
    const filterBox = await filterAction.boundingBox();
    expect(filterBox?.height || 0).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.theme-center-page .filter-scroll')).toHaveCount(1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    await stableScreenshot(page, {
      path: `test-results/theme-filter-summary-cell-${viewport.width}x${viewport.height}-dark.png`,
    });

    expect(runtimeIssues).toEqual([]);
  });
});
