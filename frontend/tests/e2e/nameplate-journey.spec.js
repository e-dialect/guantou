import { expect, test } from '@playwright/test';

const can = {
  id: 11,
  audio_url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  concept_text: '宰杀',
  duration_ms: 1000,
  nameplate_count: 1,
  nameplate_total: 1,
  primary_nameplate: { id: 21, display_text: '刣' },
  nameplate_previews: [{
    id: 21,
    is_primary: true,
    display_text: '刣',
    text_content: '刣',
    definition: '宰杀',
    pronunciation_text: 'tai',
    package: { id: 4, text: '刣', package_type: 'orthographic' },
    flavor: { id: 5, name: '宰杀', definition: '使动物死亡', mandarin: ['杀'] },
    dialect: { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋' },
    pronunciation: {
      id: 8,
      ipa: 'tʰai',
      base_romanization: 'tái',
      surface_romanization: 'tâi',
    },
    source: { type: 'book', title: '方言志', locator: '42' },
    source_type: 'book',
    evidence_level: 3,
    weight: 8,
    support_count: 6,
    comment_count: 1,
    supported_by_current_user: false,
  }],
  recorder: { id: 2, username: 'speaker', nickname: '录音人', avatar: '' },
  submitted_dialect: { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋' },
  status: 'verified',
  visibility: true,
  like_count: 0,
  comment_count: 0,
  use_count: 0,
  liked_by_me: false,
  recorder_followed_by_me: false,
  views: 2,
};

const nameplate = {
  ...can.nameplate_previews[0],
  can: { id: 11, audio_url: can.audio_url, concept_text: '宰杀' },
  status: 'active',
  is_complete: true,
  created_at: '2026-08-19T00:00:00',
  creator: { id: 2, username: 'speaker', nickname: '录音人', avatar: '' },
};

test('nameplate stays the main journey through comments, login resume, and debate', async ({ page }) => {
  let supported = false;

  await page.route('**/cans/**', async (route) => {
    await route.fulfill({
      json: { count: 1, next: null, previous: null, results: [can] },
    });
  });
  await page.route('**/nameplates/21/**', async (route) => {
    if (route.request().method() === 'PUT') {
      supported = true;
      await route.fulfill({
        json: { ...nameplate, support_count: 7, supported_by_current_user: true },
      });
      return;
    }
    await route.fulfill({
      json: { ...nameplate, supported_by_current_user: supported, support_count: supported ? 7 : 6 },
    });
  });
  await page.route('**/comments/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 31,
          author: { id: 9, username: 'reader', nickname: '读者', avatar: '' },
          content: '旧辞书也这样记录。',
          like_count: 0,
          liked_by_me: false,
          created_at: '2026-08-19T00:00:00',
        }],
      },
    });
  });
  await page.route('**/users/phone-code', async (route) => {
    await route.fulfill({ json: { demo_code: '123456', retry_after: 60 } });
  });
  await page.route('**/login/phone', async (route) => {
    await route.fulfill({ json: { token: 'e2e-token', id: 7, is_new: false } });
  });
  await page.route('**/users/7', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'collector',
          nickname: '采集者',
          primary_dialect: { id: 3, name: '游洋话', qualified_code: '闽.莆仙.游洋' },
        },
        contribution: {},
      },
    });
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 3,
          name: '游洋话',
          code: '游洋',
          qualified_code: '闽.莆仙.游洋',
          sort_order: 1,
        }],
      },
    });
  });

  // V2 首页已切换为 Recording 流；旧铭牌在阶段 8 删除前仍须可从直达链接完成闭环。
  await page.goto('/pages/nameplates/details?id=21');
  await expect(page.getByText('tái → tâi')).toBeVisible();

  await page.locator('.comments-action').click();
  await expect(page).toHaveURL(/\/pages\/nameplates\/comments\?id=21/);
  await expect(page.getByText('旧辞书也这样记录。')).toBeVisible();
  await page.locator('.shell-back').click();

  await page.locator('.support-action').click();
  await expect(page).toHaveURL(/\/pages\/login\/login/);
  const phone = page.locator('.phone-input input.uni-input-input');
  const code = page.locator('.code-input input.uni-input-input');
  await phone.fill('13800001234');
  await page.locator('.code-button').click();
  await code.fill('123456');
  await page.locator('.phone-login-button').click();

  await expect(page).toHaveURL(/\/pages\/nameplates\/details\?id=21&resume=support/);
  await expect(page.getByText('已支持 7', { exact: true })).toBeVisible();
  expect(supported).toBe(true);

  // 登录恢复后的 Loading 正在淡出时也不能继续拦截下一项操作。
  await page.locator('.debate-action').click();
  await expect(page).toHaveURL(/\/pages\/nameplates\/create\?can_id=11&reference_id=21/);
  await expect(page.getByText('你的立论会与现有铭牌并列呈现，不会覆盖或修改别人的记录。')).toBeVisible();
});
