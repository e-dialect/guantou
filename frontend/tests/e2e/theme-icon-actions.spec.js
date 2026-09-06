import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const appearances = ['light', 'dark'];

async function expectCompactCircle(button, { disabled = false } = {}) {
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('role', 'button');
  if (disabled) await expect(button).toBeDisabled();
  else await expect(button).toBeEnabled();

  const geometry = await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      width: box.width,
      height: box.height,
      radius: Number.parseFloat(styles.borderRadius),
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(20);
  expect(geometry.width).toBeLessThanOrEqual(34);
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(2);
  expect(geometry.radius).toBeGreaterThanOrEqual((geometry.height / 2) - 1);
}

appearances.forEach((appearance) => {
  test(`theme center ${appearance} exposes compact named icon actions`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme: appearance });
    await openVisualRoute(page, '/pages/users/theme-center', { persona: 'member' });

    const liveCard = page.locator('.theme-card', { hasText: '小雪窗格' });
    const upcomingCard = page.locator('.theme-card', { hasText: '川渝烟火' });
    await liveCard.scrollIntoViewIfNeeded();

    const liveFavorite = liveCard.getByRole('button', { name: '收藏主题：小雪窗格' });
    const liveShare = liveCard.getByRole('button', { name: '分享主题：小雪窗格' });
    await expectCompactCircle(liveFavorite);
    await expectCompactCircle(liveShare);

    await upcomingCard.scrollIntoViewIfNeeded();
    await expectCompactCircle(
      upcomingCard.getByRole('button', { name: '收藏主题：川渝烟火' }),
      { disabled: true },
    );
    await expectCompactCircle(
      upcomingCard.getByRole('button', { name: '分享主题：川渝烟火' }),
      { disabled: true },
    );

    await liveShare.scrollIntoViewIfNeeded();
    await liveShare.click();
    await expect(page.getByText('分享这个主题', { exact: true })).toBeVisible();
    await page.getByText('取消', { exact: true }).last().click();

    await liveCard.locator('.theme-name').click();
    const detailTools = page.locator('.sheet-tools');
    await expectCompactCircle(
      detailTools.getByRole('button', { name: '收藏主题：小雪窗格' }),
    );
    await expectCompactCircle(
      detailTools.getByRole('button', { name: '分享主题：小雪窗格' }),
    );
    await expect(page.locator('.sheet-actions').getByText('实时预览')).toBeVisible();
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await stableScreenshot(page, {
      path: `test-results/theme-icon-actions-center-${appearance}-390x844.png`,
    });
    expect(runtimeIssues).toEqual([]);
  });

  test(`theme dress ${appearance} exposes compact named icon actions`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme: appearance });
    await openVisualRoute(page, '/pages/users/theme-dress?group=navbar', { persona: 'member' });

    const liveCard = page.locator('.item-card', { hasText: '系统默认顶栏' });
    const upcomingCard = page.locator('.item-card', { hasText: '方言符号顶栏' });
    const liveFavorite = liveCard.getByRole('button', { name: '收藏装扮：系统默认顶栏' });
    const liveShare = liveCard.getByRole('button', { name: '分享装扮：系统默认顶栏' });
    await expectCompactCircle(liveFavorite);
    await expectCompactCircle(liveShare);

    await upcomingCard.scrollIntoViewIfNeeded();
    await expectCompactCircle(
      upcomingCard.getByRole('button', { name: '收藏装扮：方言符号顶栏' }),
      { disabled: true },
    );
    await expectCompactCircle(
      upcomingCard.getByRole('button', { name: '分享装扮：方言符号顶栏' }),
      { disabled: true },
    );

    await liveShare.scrollIntoViewIfNeeded();
    await liveShare.click();
    await expect(page.getByText('分享这个装扮', { exact: true })).toBeVisible();
    await page.getByText('取消', { exact: true }).last().click();

    await liveCard.locator('.item-name').click();
    const detailTools = page.locator('.sheet-tools');
    await expectCompactCircle(
      detailTools.getByRole('button', { name: '收藏装扮：系统默认顶栏' }),
    );
    await expectCompactCircle(
      detailTools.getByRole('button', { name: '分享装扮：系统默认顶栏' }),
    );
    await expect(page.locator('.sheet-actions').getByText('实时预览')).toBeVisible();
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await stableScreenshot(page, {
      path: `test-results/theme-icon-actions-dress-${appearance}-390x844.png`,
    });
    expect(runtimeIssues).toEqual([]);
  });
});
