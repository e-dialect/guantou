import { expect, test } from '@playwright/test';
import {
  CORE_VISUAL_MATRIX,
  issueLabel,
  ROUTE_VISUAL_MATRIX,
  STATE_VISUAL_MATRIX,
  THEME_JOURNEY_VISUAL_MATRIX,
} from './fixtures/visualReviewMatrix';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';
import {
  prepareVisualReviewOutput,
  visualReviewOutput,
  visualScreenshotPath,
  writeVisualReviewReport,
} from './helpers/visualReviewReport';
import { stableScreenshot } from './helpers/stableScreenshot';

test.describe.configure({ mode: 'serial' });

const artifacts = [];

function pathname(target) {
  return new URL(target, 'http://visual-review.invalid').pathname;
}

function relativeScreenshot(group, filename) {
  return `${group}/${filename}.png`;
}

async function capture(page, {
  actualPathExpected = '',
  avatarState = 'image',
  filename,
  focus = '',
  group,
  issues,
  name,
  persona = 'guest',
  state = 'success',
  strictConsole = true,
  target,
  theme = 'light',
  waitMs = 350,
}) {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, {
    avatarState, focus, persona, state, theme,
  });
  await openVisualRoute(page, target, { persona });
  await page.waitForTimeout(waitMs);

  const actualPath = new URL(page.url()).pathname;
  if (actualPathExpected) expect(actualPath).toBe(actualPathExpected);
  await expect(page.locator('body')).not.toHaveText('');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);

  const screenshot = visualScreenshotPath(group, filename);
  await stableScreenshot(page, { path: screenshot });
  artifacts.push({
    actualPath,
    avatarState,
    group,
    name,
    persona,
    responsibility: issueLabel(issues),
    screenshot: relativeScreenshot(group, filename),
    state,
    target,
    theme,
  });

  if (strictConsole) {
    expect(runtimeIssues, `${name} ${theme}/${persona} 浏览器控制台`).toEqual([]);
  }
}

test.beforeAll(async () => {
  await prepareVisualReviewOutput();
});

test.afterAll(async () => {
  await writeVisualReviewReport(artifacts, {
    registeredPageCount: ROUTE_VISUAL_MATRIX.length,
    coreVariantCount: CORE_VISUAL_MATRIX.length * 4,
    stateSampleCount: STATE_VISUAL_MATRIX.length,
    themeJourneyVariantCount: THEME_JOURNEY_VISUAL_MATRIX.length,
    outputDirectory: visualReviewOutput,
  });
});

ROUTE_VISUAL_MATRIX.forEach((entry, index) => {
  test(`route ${String(index + 1).padStart(2, '0')} ${entry.route} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: entry.expectedPath || entry.route,
      avatarState: entry.avatarState,
      filename: `${String(index + 1).padStart(2, '0')}-${entry.slug}-light-${entry.persona}`,
      group: 'routes',
      issues: entry.issues,
      name: entry.route,
      persona: entry.persona,
      target: entry.target,
    });

    if (entry.avatarState === 'missing') {
      await expect(page.locator('.avatar--fallback')).toHaveText('视');
      await expect(page.locator('.avatar--image')).toHaveCount(0);
    }
  });
});

CORE_VISUAL_MATRIX.forEach((entry) => {
  ['light', 'dark'].forEach((theme) => {
    ['guest', 'member'].forEach((persona) => {
      test(`core ${entry.surface} · ${theme} · ${persona} · ${issueLabel(entry.issues)}`, async ({ page }) => {
        const authRedirect = entry.surface === 'record' && persona === 'guest';
        await capture(page, {
          actualPathExpected: authRedirect ? '/pages/login/login' : pathname(entry.target),
          filename: `${entry.surface}-${theme}-${persona}`,
          group: 'core',
          issues: entry.issues,
          name: `${entry.surface} ${theme} ${persona}`,
          persona,
          target: entry.target,
          theme,
        });

        if (entry.surface === 'mine' && persona === 'member') {
          const avatar = page.locator('.avatar--image');
          await expect(avatar).toBeVisible();
          const image = avatar.locator('img');
          await expect(image).toHaveAttribute('src', /width=%2296%22/);
          await expect.poll(() => image.evaluate((element) => ({
            height: element.naturalHeight,
            width: element.naturalWidth,
          }))).toEqual({ height: 96, width: 96 });
        }
      });
    });
  });
});

STATE_VISUAL_MATRIX.forEach((entry) => {
  test(`state ${entry.surface} · ${entry.state} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: pathname(entry.target),
      filename: `${entry.surface}-${entry.state}-light-guest`,
      focus: entry.focus,
      group: 'states',
      issues: entry.issues,
      name: `${entry.surface} ${entry.state}`,
      state: entry.state,
      strictConsole: entry.state !== 'error',
      target: entry.target,
      waitMs: entry.state === 'loading' ? 100 : 350,
    });
  });
});

THEME_JOURNEY_VISUAL_MATRIX.forEach((entry) => {
  test(`theme journey ${entry.name} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: pathname(entry.target),
      filename: entry.slug,
      group: 'themes',
      issues: entry.issues,
      name: entry.name,
      persona: entry.persona,
      target: entry.target,
      theme: entry.theme,
    });

    if (entry.checkSoonLabel) {
      const soonLabel = page.locator('.soon-overlay').first();
      await expect(soonLabel).toBeVisible();
      expect(await soonLabel.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap');
      expect((await soonLabel.boundingBox())?.height || 0).toBeLessThan(30);
    }
  });
});
