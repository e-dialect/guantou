import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

const dialects = [
  { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
  { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
  { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋', sort_order: 1 },
];
const field = (page, label) => page.locator('.base-field')
  .filter({ has: page.getByText(label, { exact: true }) });
const submit = (page) => page.locator('.submit-card .base-button');

async function mockApi(page, { signedIn = false, failFirstSubmission = false } = {}) {
  const submissions = [];
  await page.route(/https?:\/\/[^/]+\/(dialects|files|cans|users|login)(\/|\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/dialects/') return route.fulfill({ json: dialects });
    if (url.pathname === '/files') {
      return route.fulfill({ json: { url: '/media/test-voice.webm', duration_ms: 2200 } });
    }
    if (url.pathname === '/login') return route.fulfill({ json: { id: 7, token: 'test-token' } });
    if (url.pathname === '/users/7') {
      return route.fulfill({ json: { user: { id: 7, nickname: '测试用户', primary_dialect: dialects[2] } } });
    }
    if (url.pathname === '/cans/' && route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON());
      if (failFirstSubmission && submissions.length === 1) {
        return route.fulfill({ status: 400, json: {
          message: '概念需要修正', data: { concept_text: { message: '请核对普通话概念' } },
        } });
      }
      return route.fulfill({ json: { id: 41 } });
    }
    if (url.pathname === '/cans/41/') {
      return route.fulfill({ json: { id: 41, concept_text: '月亮', nameplates: [] } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  if (signedIn) {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('id', '7');
    });
  }
  return submissions;
}

async function selectDialect(page) {
  await field(page, '方言点').locator('.t-cell').click();
  const picker = page.locator('.t-cascader');
  await picker.getByText('闽语', { exact: true }).click();
  await picker.getByText('莆仙片', { exact: true }).click();
  await picker.getByText('游洋话', { exact: true }).click();
  await expect(field(page, '方言点')).toContainText('闽语 · 莆仙片 · 游洋话');
}

async function recordAudio(page) {
  await page.locator('.record-primary').click();
  await expect(page.locator('.record-subtitle')).toContainText('2 秒 /', { timeout: 5000 });
  await page.locator('.record-primary').click();
  await expect(page.locator('.record-title')).toHaveText('录好了');
}

async function storedDrafts(page, owner = 'user:7') {
  return page.evaluate((scope) => {
    const raw = localStorage.getItem(`can_drafts:${scope}`);
    if (!raw) return [];
    const stored = JSON.parse(raw);
    return typeof stored === 'string' ? JSON.parse(stored) : stored;
  }, owner);
}

for (const theme of ['light', 'dark']) {
  test(`390×844 ${theme} form, dialect and evidence pickers`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await mockApi(page);
    await page.goto('/pages/cans/create');
    await expect(field(page, '普通话概念')).toBeVisible();
    await recordAudio(page);
    await field(page, '普通话概念').locator('input').fill('膝盖');
    await selectDialect(page);
    await page.getByText('想多说一点？（可选）', { exact: true }).click();
    await field(page, '家乡话写法').locator('input').fill('骹头前');
    await field(page, '补充说明').locator('textarea').fill('指膝盖，小时候常听奶奶这样说。');
    await field(page, '原样读音').locator('input').fill('按家乡发音记录');
    const evidence = page.locator('.picker-field').filter({ hasText: '证据等级' });
    await evidence.locator('.t-cell').click();
    const picker = page.locator('.t-picker').filter({ hasText: '选择证据等级' });
    await picker.getByText('文献考据', { exact: true }).click();
    await picker.getByText('确认', { exact: true }).click();
    await expect(evidence).toContainText('文献考据');
    await expect(picker).toBeHidden();
    await field(page, '是谁说的').locator('input').fill('奶奶');
    await field(page, '从哪里听到').locator('input').fill('小时候在家里听到');
    await field(page, '其他备注').locator('textarea').fill('保留原始录音，写法待进一步核对。');

    const controlBoxes = await page.locator('.base-field input, .base-field textarea')
      .evaluateAll((nodes) => nodes.map((node) => ({
        width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
      })));
    for (const box of controlBoxes) {
      expect(box.width).toBeGreaterThan(180);
      expect(box.height).toBeGreaterThan(20);
    }
    expect(await page.locator('.can-create-page').evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(350);
    await expect(page.locator('.page-shell')).toHaveClass(new RegExp(`theme-${theme}`));
    const colors = await field(page, '普通话概念').locator('input').evaluate((node) => ({
      text: getComputedStyle(node).color,
      background: getComputedStyle(node.closest('.t-input')).backgroundColor,
    }));
    expect(colors.text).not.toBe(colors.background);

    // Expand only the scroll container for a full-length capture at the same mobile viewport.
    await page.addStyleTag({ content: '.shell-scroll, .shell-scroll .uni-scroll-view, .shell-scroll .uni-scroll-view-content { height: auto !important; overflow: visible !important; }' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = await page.screenshot({ fullPage: true,
      ...(process.env.E2E_SCREENSHOT_DIR ? { path: `${process.env.E2E_SCREENSHOT_DIR}/can-create-${theme}-390x844.png` } : {}),
    });
    await testInfo.attach(`can-create-${theme}-390x844`, { body: screenshot, contentType: 'image/png' });
  });
}

test('H5 microphone denial keeps the form and allows recording again', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let denied = false;
    navigator.mediaDevices.getUserMedia = async (...args) => {
      if (!denied) { denied = true; throw new DOMException('Denied', 'NotAllowedError'); }
      return getUserMedia(...args);
    };
  });
  await page.goto('/pages/cans/create?prompt=月亮&dialect=3');
  await expect(field(page, '普通话概念')).toBeVisible();
  await page.locator('.record-primary').click();
  await expect(page.getByText('录音暂时无法使用，请重试', { exact: true })).toBeVisible();
  await expect(field(page, '普通话概念').locator('input')).toHaveValue('月亮');
  await recordAudio(page);
  await expect(submit(page)).not.toHaveClass(/t-button--disabled/);
});

test('submission failure restores persisted H5 audio, then success clears the draft', async ({ page }) => {
  const submissions = await mockApi(page, { signedIn: true, failFirstSubmission: true });
  await page.goto('/pages/cans/create?prompt=月亮&dialect=3');
  await expect(field(page, '普通话概念')).toBeVisible();
  await recordAudio(page);
  await submit(page).click();
  await expect(field(page, '普通话概念')).toContainText('请核对普通话概念');
  await expect.poll(async () => (await storedDrafts(page))[0]?.audio?.persisted).toBe(true);
  const [draft] = await storedDrafts(page);
  await page.goto(`/pages/cans/create?draft=${draft.id}`);
  await expect(page.locator('.record-title')).toHaveText('录好了');
  await expect(field(page, '普通话概念').locator('input')).toHaveValue('月亮');
  await expect(field(page, '方言点')).toContainText('游洋话');
  await submit(page).click();
  await expect(page).toHaveURL(/\/pages\/cans\/details\?id=41/);
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toMatchObject({ concept_text: '月亮', submitted_dialect_id: 3, duration_ms: 2200 });
  expect(submissions[1]).not.toHaveProperty('initial_nameplate');
  expect(await storedDrafts(page)).toEqual([]);
});

test('guest submission saves a recoverable draft before navigating to login', async ({ page }) => {
  const submissions = await mockApi(page);
  await page.goto('/pages/cans/create?prompt=月亮&dialect=3');
  await expect(field(page, '普通话概念')).toBeVisible();
  await recordAudio(page);
  await submit(page).click();
  await expect(page).toHaveURL(/\/pages\/login\/login/);
  const intent = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('auth_intercept_intent'));
    return typeof stored === 'string' ? JSON.parse(stored) : stored;
  });
  expect(intent.context).toMatchObject({ returnRoute: '/pages/cans/create', mode: 'free' });
  const [draft] = await storedDrafts(page, intent.context.ownerScope);
  expect(draft.id).toBe(intent.context.draftId);
  expect(draft.audio.persisted).toBe(true);
  expect(submissions).toEqual([]);
});

test('a draft with missing H5 audio keeps its fields and can be recorded again', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem('can_drafts_anonymous_session', 'test');
    localStorage.setItem('can_drafts:anonymous:test', JSON.stringify([{
      id: 'missing-audio', ownerScope: 'anonymous:test', mode: 'free',
      form: { concept_text: '月亮', submitted_dialect_id: 3 },
      label: { text_content: '月娘' },
      audio: { persisted: true, available: true, storage: 'indexeddb', mediaId: 'missing' },
    }]));
  });
  await page.goto('/pages/cans/create?draft=missing-audio');
  await expect(page.locator('.record-title')).toHaveText('录音已失效');
  await expect(submit(page)).toHaveClass(/t-button--disabled/);
  await expect(field(page, '普通话概念').locator('input')).toHaveValue('月亮');
  await expect(field(page, '家乡话写法').locator('input')).toHaveValue('月娘');
  await recordAudio(page);
  await expect.poll(async () => (await storedDrafts(page, 'anonymous:test'))[0]?.audio?.available).toBe(true);
});
