/**
 * Infinite theme animations can keep Playwright waiting for a stable frame.
 * Freeze motion only while capturing, then restore the interactive page.
 */
const STILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    animation-duration: 0s !important;
    transition: none !important;
  }
`;

export async function stableScreenshot(page, options = {}) {
  const style = await page.addStyleTag({ content: STILL_CSS });
  try {
    return await page.screenshot({
      caret: 'hide',
      timeout: 8000,
      ...options,
      animations: 'allow',
    });
  } finally {
    await style.evaluate((node) => node.remove()).catch(() => {});
  }
}
