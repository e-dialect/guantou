import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

function colorChannels(color) {
  const normalized = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16));
  }
  return normalized.match(/[\d.]+/g).slice(0, 3).map(Number);
}

function relativeLuminance(color) {
  const channels = colorChannels(color).map((value) => value / 255);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

['light', 'dark'].forEach((appearance) => {
  test(`theme share sheet ${appearance} uses one button language`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme: appearance });
    await openVisualRoute(page, '/pages/users/theme-center', { persona: 'member' });

    const card = page.locator('.theme-card', { hasText: '小雪窗格' });
    await card.scrollIntoViewIfNeeded();
    await card.locator('.icon-btn').nth(1).click();
    await expect(page.getByText('分享这个主题', { exact: true })).toBeVisible();

    const actions = ['分享给好友', '分享到微信', '复制链接', '生成分享图片']
      .map((name) => page.getByRole('button', { name }));
    await Promise.all(actions.map(async (action) => {
      await expect(action).toBeVisible();
      await expect(action).toBeEnabled();
    }));
    const widths = await page.locator('.share-row').evaluateAll((elements) => (
      elements.map((element) => element.getBoundingClientRect().width)
    ));
    expect(widths).toHaveLength(4);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    expect(Math.min(...widths)).toBeGreaterThan(280);

    await actions.at(-1).click();
    await expect(page.locator('.poster')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存到相册' })).toBeVisible();
    const activeStyle = await actions.at(-1).evaluate((element) => {
      const style = getComputedStyle(element);
      const overlay = getComputedStyle(element, '::after');
      return {
        accent: getComputedStyle(document.documentElement)
          .getPropertyValue('--accent-color').trim(),
        background: overlay.backgroundColor,
        border: overlay.borderTopColor,
        color: style.color,
      };
    });
    expect(colorChannels(activeStyle.border)).toEqual(colorChannels(activeStyle.accent));
    expect(contrastRatio(activeStyle.color, activeStyle.background)).toBeGreaterThanOrEqual(4.5);
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await stableScreenshot(page, {
      path: `test-results/theme-share-actions-${appearance}-390x844.png`,
    });
    expect(runtimeIssues).toEqual([]);

    const cancel = page.getByRole('button', { name: '取消' });
    await cancel.scrollIntoViewIfNeeded();
    await cancel.click();
    await expect(page.getByText('分享这个主题', { exact: true })).toHaveCount(0);
  });
});
