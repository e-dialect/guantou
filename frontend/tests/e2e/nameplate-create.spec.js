import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const createUrl = '/pages/nameplates/create?can_id=11&reference_id=21';
const dialects = [
  { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
  { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
  { id: 3, name: '城关', qualified_code: '闽.莆仙.城关', sort_order: 1 },
  { id: 8, name: '游洋', qualified_code: '闽.莆仙.游洋', sort_order: 2 },
];
const reference = {
  id: 21, display_text: '刣', definition: '宰杀，保留来自当地的记录。',
  dialect: dialects[3], source: {}, can: { id: 11 },
};

// Isolated API fixtures keep authoring tests from writing real business data.
async function mockApi(page, options = {}) {
  const state = { posts: [], dialectLoads: 0, referenceLoads: 0 };
  if (!options.guest) {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('id', '7');
    });
  }
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const { pathname } = new URL(request.url());
    let status = 200;
    let json = { results: [], next: null };
    if (pathname === '/login') json = { token: 'e2e-token', id: 7 };
    else if (pathname === '/users/7') {
      json = { user: { id: 7, nickname: '采集者', primary_dialect: dialects[3] } };
    } else if (pathname === '/dialects/') {
      state.dialectLoads += 1;
      json = { results: options.emptyDialects ? [] : dialects, next: null };
      if (options.failDialectsOnce && state.dialectLoads === 1) status = 500;
    } else if (pathname === '/nameplates/21/') {
      state.referenceLoads += 1;
      json = reference;
      if (options.failReferenceOnce && state.referenceLoads === 1) status = 500;
    } else if (pathname === '/nameplates/' && request.method() === 'POST') {
      state.posts.push(request.postDataJSON());
      if (options.holdSubmission) await options.holdSubmission;
      status = options.failSubmitOnce && state.posts.length === 1 ? 500 : 201;
      json = status === 500 ? { message: '发表失败，请重试' } : { id: 31 };
    } else if (pathname === '/nameplates/31/') json = { ...reference, id: 31 };
    if (status === 500 && !json.message) json = { message: '铭牌表单加载失败，请重试' };
    await route.fulfill({ status, json });
    return undefined;
  });
  return state;
}

const field = (page, name) => page.locator(`.t-form__item__${name.replace(/\./g, '-')}`);
const submit = (page) => page.locator('.create-page .base-form .base-button');
const picker = (page) => page.locator('.t-picker:visible');

async function snapshot(page, testInfo, name) {
  const path = process.env.UPDATE_MIGRATION_SCREENSHOTS === '1'
    ? resolve('..', 'docs', 'assets', 'tdesign-migration', `${name}.png`) : undefined;
  await testInfo.attach(name, {
    body: await page.screenshot({ path, animations: 'disabled' }), contentType: 'image/png',
  });
}

for (const theme of ['light', 'dark']) {
  test(`nameplate long form, joint validation and pickers at 390x844 in ${theme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    const state = await mockApi(page);
    await page.goto(createUrl);
    await expect(page.locator('.page-shell')).toHaveClass(new RegExp(`theme-${theme}`));
    await expect(page.locator('.reference-card')).toContainText('刣');
    await expect(page.locator('.dialect-cell')).toContainText('游洋');
    await expect(page.locator('.base-field')).toHaveCount(8);
    const dimensions = await field(page, 'text_content').locator('input').evaluate((input) => ({
      width: input.getBoundingClientRect().width,
      foreground: getComputedStyle(input).color,
      background: getComputedStyle(input.closest('.t-input')).backgroundColor,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(dimensions.width).toBeGreaterThan(220);
    expect(dimensions.foreground).not.toBe(dimensions.background);
    expect(dimensions.overflow).toBe(false);
    await snapshot(page, testInfo, `nameplate-create-${theme}-390x844`);
    await field(page, 'text_content').locator('input').fill('   ');
    await submit(page).click();
    for (const name of ['text_content', 'pronunciation_text']) {
      await expect(field(page, name).locator('.t-form__item-extra')).toContainText('写法或实际读音至少填写一项');
    }
    await expect(field(page, 'text_content')).toBeInViewport();
    expect(state.posts).toHaveLength(0);
    await field(page, 'pronunciation_text').locator('input').fill(' tai ');
    await expect(field(page, 'text_content').locator('.t-form__item-extra')).toHaveCount(0);
    await page.locator('.dialect-cell').click();
    const selector = page.locator('.dialect-selector:visible');
    await expect(selector).toContainText('莆仙方言');
    await expect(selector).toBeInViewport({ ratio: 1 });
    await snapshot(page, testInfo, `nameplate-create-picker-${theme}-390x844`);
    await selector.getByText('全部方言', { exact: true }).click();
    await selector.locator('.dialect-selector__node').filter({ hasText: '闽语' }).click();
    await selector.locator('.dialect-selector__node').filter({ hasText: '莆仙方言' }).click();
    await selector.locator('.dialect-selector__current .base-button').filter({ hasText: '就选这里' }).click();
    await expect(page.locator('.dialect-cell')).toContainText('闽语 › 莆仙方言');
    await page.locator('.dialect-cell').click();
    await selector.locator('.dialect-selector__node').filter({ hasText: '城关' }).click();
    await expect(page.locator('.dialect-cell')).toContainText('闽语 › 莆仙方言 › 城关');
    await page.locator('.dialect-cell').click();
    await expect(selector.locator('.dialect-selector__shortcuts')).toContainText('最近');
    await selector.locator('.dialect-selector__shortcuts .base-button').filter({ hasText: '默认 · 莆仙方言 · 游洋' }).click();
    await expect(page.locator('.dialect-cell')).toContainText('游洋');
    await page.locator('.dialect-cell').click();
    await selector.locator('.dialect-selector__shortcuts .base-button').filter({ hasText: '最近 · 莆仙方言 · 城关' }).click();
    await expect(page.locator('.dialect-cell')).toContainText('城关');
    await page.locator('.source-cell').click();
    await expect(picker(page)).toContainText('选择资料来源类型');
    await expect(picker(page)).toBeInViewport({ ratio: 1 });
    await snapshot(page, testInfo, `nameplate-create-source-${theme}-390x844`);
    await picker(page).getByText('口述', { exact: true }).click();
    await picker(page).locator('.t-picker__cancel').click();
    await expect(page.locator('.source-cell')).toContainText('创作者自述');
    await page.locator('.source-cell').click();
    await expect(picker(page).locator('.t-picker-item__item--active')).toContainText('创作者自述');
    await picker(page).getByText('口述', { exact: true }).click();
    await picker(page).locator('.t-picker__confirm').click();
    await expect(page.locator('.source-cell')).toContainText('口述');
    await field(page, 'definition').locator('textarea').fill(' 宰杀 ');
    await field(page, 'source.title').locator('input').fill(' 访谈记录 ');
    await field(page, 'source.attributed_to').locator('input').fill('   ');
    await field(page, 'source.note').locator('textarea').fill(' 保留原话 ');
    await submit(page).scrollIntoViewIfNeeded();
    await snapshot(page, testInfo, `nameplate-create-footer-${theme}-390x844`);
    await submit(page).click();
    await expect(page).toHaveURL(/\/pages\/nameplates\/details\?id=31$/);
    expect(state.posts).toEqual([{
      can_id: 11, text_content: '', pronunciation_text: 'tai', definition: '宰杀',
      dialect_id: 3, evidence_level: 2,
      source: { type: 'oral', title: ' 访谈记录 ', note: ' 保留原话 ' },
    }]);
  });
}

for (const source of ['Dialects', 'Reference']) {
  test(`failed ${source} load shows a retry state and then restores the reference`, async ({ page }) => {
    const state = await mockApi(page, { [`fail${source}Once`]: true });
    await page.goto(createUrl);
    await expect(page.locator('.empty-state')).toContainText('铭牌表单加载失败，请重试');
    await expect(page.locator('.base-form')).toHaveCount(0);
    await page.locator('.empty-state .base-button').click();
    await expect(page.locator('.reference-card')).toContainText('刣');
    await expect(field(page, 'text_content').locator('input')).toBeVisible();
    expect(state.posts).toHaveLength(0);
    expect(state.dialectLoads).toBe(2);
    expect(state.referenceLoads).toBe(2);
  });
}

test('submission failure preserves the draft and allows retry', async ({ page }) => {
  const state = await mockApi(page, { failSubmitOnce: true });
  await page.goto(createUrl);
  await field(page, 'text_content').locator('input').fill(' 刣 ');
  await submit(page).click();
  await expect(page.locator('.submit-error')).toContainText('发表失败，请重试');
  await expect(field(page, 'text_content').locator('input')).toHaveValue(' 刣 ');
  await expect(submit(page)).not.toHaveClass(/t-button--disabled/);
  await submit(page).click();
  await expect(page).toHaveURL(/\/pages\/nameplates\/details\?id=31$/);
  expect(state.posts).toHaveLength(2);
  expect(state.posts[0]).toEqual(state.posts[1]);
});

test('pending submission disables the action and fields', async ({ page }) => {
  let finish;
  const holdSubmission = new Promise((resolve) => { finish = resolve; });
  const state = await mockApi(page, { holdSubmission });
  await page.goto(createUrl);
  await field(page, 'text_content').locator('input').fill('刣');
  await submit(page).click();
  await expect(submit(page)).toHaveClass(/t-button--disabled/);
  await expect(field(page, 'text_content').locator('input')).toBeDisabled();
  await submit(page).dispatchEvent('click');
  await expect.poll(() => state.posts.length).toBe(1);
  finish();
  await expect(page).toHaveURL(/\/pages\/nameplates\/details\?id=31$/);
  expect(state.posts).toHaveLength(1);
});

test('guest is redirected with the original can and reference intent', async ({ page }) => {
  const state = await mockApi(page, { guest: true });
  await page.goto(createUrl);
  await expect(page).toHaveURL(/\/pages\/login\/login/);
  const intent = await page.evaluate(() => JSON.parse(localStorage.getItem('auth_intercept_intent')));
  expect(intent).toMatchObject({ action: 'nameplate_create', context: { canId: 11, nameplateId: 21 } });
  expect(state.dialectLoads).toBe(0);
  expect(state.referenceLoads).toBe(0);
});
