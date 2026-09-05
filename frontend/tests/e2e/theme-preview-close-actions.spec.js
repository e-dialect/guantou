import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

async function expectCloseAction(button) {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const geometry = await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(48);
  expect(geometry.height).toBeGreaterThanOrEqual(32);
}

['light', 'dark'].forEach((appearance) => {
  test(`theme preview ${appearance} keeps consistent close actions`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme: appearance });
    await openVisualRoute(page, '/pages/users/theme-center', { persona: 'member' });

    const themeCard = page.locator('.theme-card', { hasText: '小雪窗格' });
    await themeCard.scrollIntoViewIfNeeded();
    await themeCard.locator('.theme-name').click();
    await page.locator('.sheet .shot-lg').first().click();

    const themeZoomClose = page.getByRole('button', { name: '关闭主题大图' });
    await expectCloseAction(themeZoomClose);
    await stableScreenshot(page, {
      path: `test-results/theme-preview-close-theme-zoom-${appearance}-390x844.png`,
    });
    await themeZoomClose.click();

    await page.locator('.sheet-actions').getByText('实时预览').click();
    const livePreviewClose = page.getByRole('button', { name: '关闭实时预览' });
    await expectCloseAction(livePreviewClose);
    await stableScreenshot(page, {
      path: `test-results/theme-preview-close-live-${appearance}-390x844.png`,
    });
    await livePreviewClose.click();
    await page.locator('.sheet-actions').getByText('取消').click();

    await openVisualRoute(page, '/pages/users/theme-dress?group=navbar', { persona: 'member' });
    const dressCard = page.locator('.item-card', { hasText: '系统默认顶栏' });
    await dressCard.locator('.item-name').click();
    await page.locator('.sheet .thumb-lg').click();

    const dressZoomClose = page.getByRole('button', { name: '关闭装扮大图' });
    await expectCloseAction(dressZoomClose);
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await stableScreenshot(page, {
      path: `test-results/theme-preview-close-dress-zoom-${appearance}-390x844.png`,
    });
    await dressZoomClose.click();
    await expect(page.locator('.zoom-mask')).toHaveCount(0);
    expect(runtimeIssues).toEqual([]);
  });
});
