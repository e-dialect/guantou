import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });
test.skip(true, 'V2 首页不再挂载旧 Can 操作栏；浮层逻辑由 CommentSheet 单元测试覆盖，阶段 8 一并移除旧宿主');

const scrollSelector = '.comment-sheet__scroll > .uni-scroll-view > .uni-scroll-view';

// Isolated responses: no backend writes or external audio are needed.
async function mockComments(page, count = 30) {
  const author = { id: 3, nickname: '测试乡友', username: 'reader', avatar: '' };
  const comments = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    author,
    content: `第 ${index + 1} 条评论：保留这段乡音的真实读法与使用场景。`,
    created_at: '2026-09-03T08:00:00Z',
    like_count: 0,
    reply_count: 0,
  }));
  await page.route('**/*', async (route) => {
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
    const { pathname } = new URL(route.request().url());
    let results = [];
    if (pathname === '/cans/') {
      results = [11, 12, 13].map((id) => ({
        id,
        concept_text: `乡音 ${id}`,
        nameplate_previews: [],
        recorder: author,
        comment_count: count,
      }));
    } else if (pathname === '/comments/') {
      results = comments;
    }
    return route.fulfill({ json: { count: results.length, results, next: null } });
  });
}

async function swipe(page, x, fromY, toY) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y: fromY }],
  });
  for (let step = 1; step <= 12; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: fromY + (toY - fromY) * step / 12 }],
    });
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  // Wait for native momentum and swiper transitions to settle before measuring.
  await page.waitForTimeout(400);
}

async function backgroundState(page) {
  return page.locator('.home-feed').evaluate((feed) => ({
    pageY: window.scrollY,
    top: feed.getBoundingClientRect().top,
    slides: [...feed.querySelectorAll('uni-swiper-item')].map((slide) => (
      slide.getBoundingClientRect().top
    )),
  }));
}

async function swipeList(page, down = false) {
  // The fixed composer reduces list height: derive touch positions from the real scroller.
  const box = await page.locator(scrollSelector).boundingBox();
  const top = box.y + box.height * 0.25;
  const bottom = box.y + box.height * 0.75;
  await swipe(page, box.x + box.width / 2, down ? top : bottom, down ? bottom : top);
}

async function dragGrip(page, delta) {
  const box = await page.locator('.comment-sheet__grip').boundingBox();
  const y = box.y + box.height / 2;
  await swipe(page, box.x + box.width / 2, y, y + delta);
}

async function openSheet(page) {
  const button = page.getByRole('button', { name: '评论', exact: true });
  await expect(button).toBeVisible();
  await page.locator('.action-rail').evaluate(async (rail) => {
    await Promise.all(rail.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
  await expect.poll(() => button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  // Tap the visible control without Playwright scrolling hidden swiper wrappers into view.
  const box = await button.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.comment-sheet__panel--active')).toBeVisible();
  await expect(page.locator('.comment-thread')).toBeVisible();
  await page.waitForTimeout(350);
}

for (const theme of ['light', 'dark']) {
  test(`comment scrolling stays inside the sheet (${theme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await mockComments(page);
    await page.goto('/');
    const rail = await page.locator('.action-rail').elementHandle();
    const beforeOpen = await backgroundState(page);
    await openSheet(page);
    expect(await backgroundState(page)).toEqual(beforeOpen);
    const scroll = page.locator(scrollSelector);
    const before = await backgroundState(page);
    await swipeList(page);
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await backgroundState(page)).toEqual(before);

    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await swipeList(page);
    expect(await backgroundState(page)).toEqual(before);

    await scroll.evaluate((el) => { el.scrollTop = 0; });
    await swipeList(page, true);
    expect(await backgroundState(page)).toEqual(before);

    // A mask gesture must not scroll the document or reach the feed.
    await swipe(page, 190, 330, 130);
    expect(await backgroundState(page)).toEqual(before);
    await testInfo.attach(`comment-sheet-${theme}`, {
      body: await page.screenshot({ path: testInfo.outputPath(`comment-sheet-${theme}.png`) }),
      contentType: 'image/png',
    });

    await page.touchscreen.tap(190, 180);
    await expect(page.locator('.comment-sheet__layer')).toHaveCount(0);
    expect(await rail.evaluate((el) => el.isConnected)).toBe(true);
    await swipe(page, 190, 700, 260);
    expect((await backgroundState(page)).slides).not.toEqual(before.slides);
  });

  test(`resizing preserves scroll isolation and the fixed composer (${theme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await mockComments(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '评论', exact: true })).toBeVisible();
    await page.addStyleTag({ content: 'body { min-height: 1800px; }' });
    await page.evaluate(() => window.scrollTo(0, 160));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(160);
    const rail = await page.locator('.action-rail').elementHandle();
    const beforeOpen = await backgroundState(page);
    await openSheet(page);
    const before = await backgroundState(page);
    expect(before.top).toBe(beforeOpen.top);
    expect(before.slides).toEqual(beforeOpen.slides);

    const composer = page.locator('.comment-sheet__composer');
    const input = composer.locator('textarea');
    await input.fill('缩放时保留评论草稿');
    const halfBox = await composer.boundingBox();
    expect(halfBox.y + halfBox.height).toBeLessThanOrEqual(844);
    await expect(page.locator('.comment-sheet textarea')).toHaveCount(1);
    await swipeList(page);
    const scroll = page.locator(scrollSelector);
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await composer.boundingBox()).toEqual(halfBox);

    await dragGrip(page, -180);
    await expect(page.locator('.comment-sheet__panel--full')).toBeVisible();
    const panel = await page.locator('.comment-sheet__panel').boundingBox();
    expect(panel.height).toBeCloseTo(844, 0);
    await expect(input).toHaveValue('缩放时保留评论草稿');
    const fullBox = await composer.boundingBox();
    expect(fullBox).toEqual(halfBox);

    await scroll.evaluate((el) => { el.scrollTop = 0; });
    await swipeList(page);
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await composer.boundingBox()).toEqual(fullBox);
    await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await swipeList(page);
    await page.mouse.move(190, 500);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    expect(await backgroundState(page)).toEqual(before);
    await scroll.evaluate((el) => { el.scrollTop = 0; });
    await swipeList(page, true);
    expect(await backgroundState(page)).toEqual(before);
    expect(await composer.boundingBox()).toEqual(fullBox);
    await testInfo.attach(`comment-sheet-full-${theme}`, {
      body: await page.screenshot({ path: testInfo.outputPath(`comment-sheet-full-${theme}.png`) }),
      contentType: 'image/png',
    });

    await dragGrip(page, 130);
    await expect(page.locator('.comment-sheet__panel--full')).toHaveCount(0);
    await expect(page.locator('.comment-sheet__panel--active')).toBeVisible();
    await expect(input).toHaveValue('缩放时保留评论草稿');
    expect(await composer.boundingBox()).toEqual(halfBox);
    expect(await backgroundState(page)).toEqual(before);
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
    await dragGrip(page, 130);
    await expect(page.locator('.comment-sheet__layer')).toHaveCount(0);
    expect(await backgroundState(page)).toEqual(beforeOpen);
    expect(await rail.evaluate((el) => el.isConnected)).toBe(true);
  });
}

test('touch and wheel scrolling cannot chain to the page at the list boundary', async ({ page }) => {
  await mockComments(page);
  await page.goto('/');
  // Model a scrollable H5 page wrapper: the overlay must isolate it too.
  await page.addStyleTag({ content: 'body { min-height: 1800px; }' });
  await openSheet(page);
  const scroll = page.locator(scrollSelector);
  const before = await backgroundState(page);
  await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await swipeList(page);
  expect(await backgroundState(page)).toEqual(before);
  await page.mouse.move(190, 650);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  expect(await backgroundState(page)).toEqual(before);

  await page.mouse.move(190, 180);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  expect(await backgroundState(page)).toEqual(before);
});

for (const count of [0, 1]) {
  test(`short comment list (${count}) stays isolated and closing restores page scroll`, async ({ page }) => {
    await mockComments(page, count);
    await page.goto('/');
    await page.addStyleTag({ content: 'body { min-height: 1800px; }' });
    await openSheet(page);
    const before = await backgroundState(page);
    await swipeList(page);
    expect(await backgroundState(page)).toEqual(before);
    await swipeList(page, true);
    expect(await backgroundState(page)).toEqual(before);
    const listBox = await page.locator(scrollSelector).boundingBox();
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    expect(await backgroundState(page)).toEqual(before);

    // The scroll lock must not disable editing or the grip's close gesture.
    await page.locator('.comment-sheet textarea').fill('这段读音的补充依据');
    await expect(page.locator('.comment-sheet textarea')).toHaveValue('这段读音的补充依据');
    await dragGrip(page, 130);
    await expect(page.locator('.comment-sheet__layer')).toHaveCount(0);
    await page.mouse.move(190, 180);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}
