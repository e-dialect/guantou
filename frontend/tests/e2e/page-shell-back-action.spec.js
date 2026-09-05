import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const viewports = [
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

viewports.forEach((viewport) => {
  test(`PageShell ${viewport.name} keeps one centered round back action`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize(viewport);
    await installVisualFixture(page, { persona: 'member', theme: viewport.theme });
    await openVisualRoute(page, '/pages/users/theme-member', { persona: 'member' });

    const back = page.getByRole('button', { name: '返回', exact: true });
    await expect(back).toBeVisible();
    await expect(back).toBeEnabled();
    await expect(back).toHaveClass(/base-button/);

    const geometry = await page.locator('.shell-topbar').evaluate((topbar) => {
      const shellRect = topbar.getBoundingClientRect();
      const titleRect = topbar.querySelector('.shell-title').getBoundingClientRect();
      const backRect = topbar.querySelector('.shell-back').getBoundingClientRect();
      return {
        backWidth: backRect.width,
        backHeight: backRect.height,
        titleOffset: (titleRect.left + titleRect.width / 2)
          - (shellRect.left + shellRect.width / 2),
      };
    });

    expect(Math.abs(geometry.backWidth - geometry.backHeight)).toBeLessThanOrEqual(1);
    expect(geometry.backWidth).toBeGreaterThanOrEqual(32);
    expect(Math.abs(geometry.titleOffset)).toBeLessThanOrEqual(1);
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);

    await stableScreenshot(page, {
      path: `test-results/page-shell-back-${viewport.name}.png`,
    });

    await back.click();
    await expect(page.locator('.home-page')).toBeVisible();
    expect(runtimeIssues).toEqual([]);
  });
});
