import { test, expect } from '@playwright/test';
import { installVisualFixture, observeRuntime, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';

for (const theme of ['light', 'dark']) {
  test(`entry-first collection ${theme}`, async ({ page }, testInfo) => {
    const runtime = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme });
    await openVisualRoute(page, '/pages/collections/details?id=1', { persona: 'member' });
    await expect(page.getByText('雨落故乡', { exact: true })).toBeVisible();
    await expect(page.getByText('展开 1 段录音', { exact: true })).toBeVisible();
    await page.getByText('展开 1 段录音', { exact: true }).click();
    await expect(page.getByText('查看全部录音', { exact: true })).toBeVisible();
    await expect(page.getByText('录音详情', { exact: true })).toBeVisible();
    await page.getByText('听录音', { exact: true }).first().click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`collection-${theme}.png`), fullPage: true });
    await page.getByText('整理目录', { exact: true }).click();
    await expect(page.getByText('挑选录音', { exact: true })).toBeVisible();
    await page.getByText('录音详情', { exact: true }).click();
    await expect(page.getByText('乡音留言', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`recording-${theme}.png`), fullPage: true });
    expect(runtime).toEqual([]);
  });
}

test('collection directory fits desktop and its box label remains editable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installVisualFixture(page, { persona: 'member' });
  await openVisualRoute(page, '/pages/collections/details?id=1', { persona: 'member' });
  await page.getByText('编辑盒签', { exact: true }).click();
  await expect(page.getByText('保存盒签', { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('collection-desktop.png'), fullPage: true });
});

test('text draft survives refresh and resumes into recording form', async ({ page }) => {
  await installVisualFixture(page, { persona: 'member', preserveStorage: true });
  await openVisualRoute(page, '/pages/recordings/create', { persona: 'member' });
  const gloss = page.getByPlaceholder('用普通话或你习惯的方式说明意思');
  // The actual BaseField label is the durable accessible entry point.
  const field = page.locator('textarea').first();
  if (await gloss.count()) await gloss.fill('窗外开始落大雨');
  else await field.fill('窗外开始落大雨');
  await page.getByText('保存草稿', { exact: true }).click();
  await expect(page.getByText('草稿已保存，可稍后继续', { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByText('草稿箱', { exact: true }).click();
  await expect(page.getByText('窗外开始落大雨', { exact: true })).toBeVisible();
  await page.getByText('继续录制', { exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue('窗外开始落大雨');
});
