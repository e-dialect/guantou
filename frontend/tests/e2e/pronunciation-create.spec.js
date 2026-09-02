import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const createUrl = '/pages/pronunciations/create?flavor_id=1';
const flavor = {
  id: 1,
  name: '行走',
  definition: '用脚向前移动，为这个义项补充地方读法。',
  package_links: [
    { id: 1, mapping_type: 'primary', package: { id: 2, text: '行' } },
    { id: 2, mapping_type: 'variant', package: { id: 5, text: '行走' } },
  ],
  pronunciations: [],
};
const dialects = [
  { id: 1, name: '闽语', qualified_code: '闽', sort_order: 1 },
  { id: 2, name: '莆仙片', qualified_code: '闽.莆仙', sort_order: 1 },
  { id: 3, name: '城关', qualified_code: '闽.莆仙.城关', sort_order: 1 },
];

// All API responses are isolated fixtures: these tests never create server data.
async function mockApi(page, options = {}) {
  const state = { posts: [], flavorLoads: 0, dialectLoads: 0 };
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const { pathname } = new URL(request.url());
    let json = { results: [], next: null };
    let status = 200;
    if (pathname === '/flavors/1/') {
      state.flavorLoads += 1;
      json = options.flavor || flavor;
      if (options.failFlavorOnce && state.flavorLoads === 1) status = 500;
    } else if (pathname === '/dialects/') {
      state.dialectLoads += 1;
      json = { results: dialects, next: null };
      if (options.failDialectsOnce && state.dialectLoads === 1) status = 500;
    } else if (pathname === '/pronunciations/' && request.method() === 'POST') {
      state.posts.push(request.postDataJSON());
      status = options.submitStatus || 201;
      json = options.submitError || { id: 11, status: 'draft' };
    }
    await route.fulfill({ status, json });
    return undefined;
  });
  return state;
}

const field = (page, name) => page.locator(`.t-form__item__${name}`);
const save = (page) => page.locator('.submit-card .base-button');

async function chooseCoreOptions(page) {
  await field(page, 'ipa').locator('input').fill(' hiŋ²³ ');
  await field(page, 'package_id').locator('.t-cell').click();
  await page.locator('.t-picker__confirm').click();
  await expect(field(page, 'package_id')).toContainText('行 · primary');
  await field(page, 'dialect_id').locator('.t-cell').click();
  const cascader = page.locator('.t-cascader');
  await cascader.getByText('闽语', { exact: true }).click();
  await cascader.getByText('莆仙片', { exact: true }).click();
  await cascader.getByText('城关', { exact: true }).click();
  await expect(field(page, 'dialect_id')).toContainText('闽语 · 莆仙片 · 城关');
}

async function snapshot(page, testInfo, name) {
  // Opt-in refresh keeps ordinary test runs from modifying tracked documentation.
  const path = process.env.UPDATE_MIGRATION_SCREENSHOTS === '1'
    ? resolve('..', 'docs', 'assets', 'tdesign-migration', `${name}.png`) : undefined;
  await testInfo.attach(name, {
    body: await page.screenshot({ path }),
    contentType: 'image/png',
  });
}

for (const theme of ['light', 'dark']) {
  test(`pronunciation form and validation at 390x844 in ${theme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    const state = await mockApi(page);
    await page.goto(createUrl);
    await expect(page.locator('.page-shell')).toHaveClass(new RegExp(`theme-${theme}`));
    await expect(field(page, 'ipa').locator('input')).toBeVisible();
    await expect(field(page, 'package_id')).toContainText('请选择关联写法');
    await expect(page.locator('.base-field')).toHaveCount(6);
    const sizes = await field(page, 'ipa').locator('input').evaluate((input) => ({
      width: input.getBoundingClientRect().width,
      height: input.getBoundingClientRect().height,
      text: getComputedStyle(input).color,
      background: getComputedStyle(input.closest('.t-input')).backgroundColor,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(sizes.width).toBeGreaterThan(220);
    expect(sizes.height).toBeGreaterThan(20);
    expect(sizes.text).not.toBe(sizes.background);
    expect(sizes.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(sizes.overflow).toBe(false);
    await snapshot(page, testInfo, `pronunciation-create-${theme}-390x844`);
    await save(page).click();
    await expect(field(page, 'ipa')).toContainText('请填写 IPA');
    await expect(field(page, 'package_id')).toContainText('请选择该义项下的写法');
    await expect(field(page, 'dialect_id').locator('.t-form__item-extra')).toContainText('请选择方言点');
    await expect(field(page, 'ipa')).toBeInViewport();
    expect(state.posts).toHaveLength(0);
  });
}

test('linked pickers, paired sandhi validation, cleaned payload and success return', async ({ page }, testInfo) => {
  const state = await mockApi(page);
  await page.goto(createUrl);
  await chooseCoreOptions(page);
  await field(page, 'reading_type').locator('.base-button').filter({ hasText: '文读' }).click();
  const advanced = page.getByText('更多语言学信息', { exact: true });
  await advanced.click();
  await field(page, 'base_romanization').locator('input').fill(' hing5 ');
  await advanced.click();
  await save(page).click();
  await expect(field(page, 'base_romanization').locator('.t-form__item-extra')).toContainText('变调前后形式必须成对填写');
  await expect(field(page, 'base_romanization')).toBeInViewport();
  expect(state.posts).toHaveLength(0);
  await snapshot(page, testInfo, 'pronunciation-create-sandhi-error-390x844');
  await field(page, 'surface_romanization').locator('input').fill(' hing2 ');
  await field(page, 'sandhi_environment').locator('input').fill(' 词中 ');
  await field(page, 'usage_note').locator('textarea').fill(' 文读 ');
  await field(page, 'source_citation').locator('input').fill(' 田野记录 ');
  await save(page).click();
  await expect(page).toHaveURL(/\/pages\/flavors\/details\?id=1$/);
  expect(state.posts).toEqual([{
    flavor_id: 1, package_id: 2, dialect_id: 3, ipa: 'hiŋ²³',
    base_romanization: 'hing5', surface_romanization: 'hing2',
    reading_type: 'literary', sandhi_info: { environment: '词中' },
    usage_note: '文读', source_citation: '田野记录',
  }]);
});

test('backend field errors expand and locate advanced controls without a duplicate toast', async ({ page }) => {
  await mockApi(page, {
    submitStatus: 400,
    submitError: { message: '请求参数有误', data: {
      sandhi_info: { code: 'invalid', message: '请补充变调证据' },
      source_citation: { code: 'invalid', message: '请注明资料来源' },
    } },
  });
  await page.goto(createUrl);
  await chooseCoreOptions(page);
  await save(page).click();
  await expect(field(page, 'sandhi_environment')).toContainText('请补充变调证据');
  await expect(field(page, 'sandhi_environment')).toBeInViewport();
  await expect(field(page, 'source_citation')).toContainText('请注明资料来源');
  await expect(page.getByText('请求参数有误', { exact: true })).toHaveCount(0);
  await expect(field(page, 'ipa').locator('input')).toHaveValue(' hiŋ²³ ');
});

for (const failedSource of ['Flavor', 'Dialects']) {
  test(`failed ${failedSource} options recover through the shared retry state`, async ({ page }) => {
    const state = await mockApi(page, { [`fail${failedSource}Once`]: true });
    await page.goto(createUrl);
    await expect(page.getByText('读音表单加载失败，请重试', { exact: true })).toBeVisible();
    await expect(page.locator('.base-form')).toHaveCount(0);
    await page.locator('.empty-state .base-button').click();
    await expect(field(page, 'ipa').locator('input')).toBeVisible();
    expect(state.flavorLoads).toBe(2);
    expect(state.dialectLoads).toBe(2);
  });
}

test('unlinked flavors cannot submit', async ({ page }) => {
  const state = await mockApi(page, { flavor: { ...flavor, package_links: [] } });
  await page.goto(createUrl);
  await expect(page.getByText('该义项还没有关联写法，请先通过贴铭牌建立写法关系。')).toBeVisible();
  await expect(save(page)).toHaveClass(/t-button--disabled/);
  expect(state.posts).toHaveLength(0);
});
