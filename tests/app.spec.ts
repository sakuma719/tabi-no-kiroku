import { test, expect, type Page } from '@playwright/test';

// A deterministic local tile fixture keeps repeated E2E runs off the public OSM
// service. Leaflet layout, markers, popups and map controls run unmodified.
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZWkAAAAASUVORK5CYII=',
  'base64',
);
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: tile }),
  );
  await page.goto('./');
});

async function createTrip(page: Page) {
  await page.getByRole('button', { name: 'はじめての旅をつくる' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('旅行名').fill('別府');
  await dialog.getByLabel('開始日').fill('2026-11-01');
  await dialog.getByLabel('終了日').fill('2026-11-03');
  await dialog.getByLabel('行先エリア').fill('大分県 別府市');
  await dialog.getByRole('button', { name: '旅行を保存する' }).click();
  await expect(page.getByRole('heading', { name: '別府の旅', exact: true })).toBeVisible();
}

async function addSchedule(page: Page, title: string, start = '10:00', end = '11:00') {
  await page.getByRole('button', { name: '予定を追加する' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('予定名・行先').fill(title);
  await dialog.getByLabel('開始時刻').fill(start);
  if (end) await dialog.getByLabel('終了時刻').fill(end);
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await expect(dialog).toBeHidden();
}

async function sample(page: Page) {
  await page.getByRole('button', { name: 'サンプルの「別府の旅」を試す' }).click();
  await expect(page.getByRole('heading', { name: '別府の旅', exact: true })).toBeVisible();
}

function card(page: Page, title: string) {
  return page
    .locator('.schedule-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test('旅行作成、DAY切替、追加・編集、再読み込みで永続化する', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createTrip(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab', { name: /DAY 2/ }).click();
  await page.getByRole('button', { name: '予定を追加する' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('日付')).toHaveValue('2026-11-02');
  await dialog.getByLabel('予定名・行先').fill('温泉でひと休み');
  await dialog.getByLabel('開始時刻').fill('13:00');
  await dialog.getByLabel('終了時刻').fill('14:30');
  await expect(dialog.getByText('滞在時間 1時間30分')).toBeVisible();
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await page.getByRole('button', { name: '温泉でひと休みを編集' }).click();
  await dialog.getByLabel('予定名・行先').fill('温泉とお茶');
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await page.reload();
  await page.getByRole('tab', { name: /DAY 2/ }).click();
  await expect(page.getByRole('heading', { name: '温泉とお茶' })).toBeVisible();
  await expect(card(page, '温泉とお茶').getByText('滞在 1時間30分')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('次の予定までを再計算し、重複を警告しても保存できる', async ({ page }) => {
  await createTrip(page);
  await addSchedule(page, '海地獄');
  await addSchedule(page, 'ランチ', '12:30', '13:30');
  await expect(page.getByText('次の予定まで 1時間30分')).toBeVisible();
  await page.getByRole('button', { name: '海地獄を編集' }).click();
  await page.getByRole('dialog').getByLabel('終了時刻').fill('12:45');
  await expect(
    page.getByRole('dialog').getByText('予定が重なっています。確認して保存できます。'),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '予定を保存する' }).click();
  await expect(card(page, '海地獄').getByText('予定が重なっています')).toBeVisible();
  await page.getByRole('button', { name: '海地獄を編集' }).click();
  await page.getByRole('dialog').getByLabel('終了時刻').fill('');
  await page.getByRole('button', { name: '予定を保存する' }).click();
  await expect(page.locator('.schedule-gap')).toHaveCount(0);
});

test('地点、移動、メモを保存し、地図のピンとGoogleマップを開ける', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: '予定を追加する' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('予定名・行先').fill('海地獄');
  await dialog.locator('summary').filter({ hasText: '移動・スポット情報' }).click();
  await dialog.getByLabel('移動手段').selectOption('バス');
  await dialog.getByLabel('発車時刻').fill('08:20');
  await dialog.getByLabel('移動時間（分）').fill('25');
  await dialog.getByLabel('スポット連携').selectOption('new');
  await dialog.getByLabel('緯度', { exact: true }).fill('33.3156');
  await dialog.getByLabel('経度', { exact: true }).fill('131.4692');
  await dialog.getByLabel('GoogleマップURL').fill('https://maps.app.goo.gl/example');
  await dialog.getByLabel('スポット一覧に保存').check();
  await dialog.locator('summary').filter({ hasText: 'メモ' }).click();
  await dialog.getByLabel('メモ', { exact: true }).fill('予約番号 123\n入場料を確認');
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await expect(card(page, '海地獄').getByText('ここへ：バス · 08:20発 · 25分')).toBeVisible();
  await card(page, '海地獄').getByText('メモを見る').click();
  await expect(card(page, '海地獄').getByText('予約番号 123')).toBeVisible();
  await expect(card(page, '海地獄').getByRole('link', { name: 'Googleマップ' })).toHaveAttribute(
    'href',
    'https://maps.app.goo.gl/example',
  );
  await page.getByRole('button', { name: '海地獄', exact: true }).click();
  await expect(page.locator('.leaflet-popup-content')).toHaveText('海地獄');
  await expect(page.getByRole('link', { name: 'OpenStreetMap' })).toBeVisible();
  await page.getByRole('button', { name: '地図を閉じる' }).click();
  await expect(page.locator('.trip-map')).toHaveCount(0);
  await page.getByRole('button', { name: '地図を開く' }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  // Reuse the normalized spot rather than copying its data to each schedule.
  await page.getByRole('button', { name: '予定を追加する' }).click();
  await dialog.getByLabel('予定名・行先').fill('もう一度海地獄へ');
  await dialog.getByLabel('開始時刻').fill('16:00');
  await dialog.locator('summary').filter({ hasText: '移動・スポット情報' }).click();
  await dialog.getByLabel('スポット連携').selectOption('existing');
  await dialog
    .getByRole('combobox', { name: '登録済みスポット', exact: true })
    .selectOption({ label: '海地獄' });
  await expect(dialog.getByLabel('緯度', { exact: true })).toHaveValue('33.3156');
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
});

test('不正なマップURLを拒否し、未保存で閉じる時だけ確認する', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: '予定を追加する' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: '予定を追加する' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('予定名・行先').fill('テスト');
  page.once('dialog', (confirm) => confirm.dismiss());
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('summary').filter({ hasText: '移動・スポット情報' }).click();
  await dialog.getByLabel('スポット連携').selectOption('new');
  await dialog.getByLabel('GoogleマップURL').fill('https://www.google.com.evil.test/maps');
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await expect(dialog.getByRole('alert')).toContainText('HTTPSのGoogleマップURL');
  page.once('dialog', (confirm) => confirm.accept());
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'テスト', exact: true })).toHaveCount(0);
});

test('ドラッグ並び替えで時刻を維持し、再読み込み後も順序を保持する', async ({ page }) => {
  await sample(page);
  const first = page.getByRole('button', { name: '別府駅に到着をドラッグして並び替え' });
  const second = page.getByRole('button', { name: '海地獄を散策をドラッグして並び替え' });
  await first.scrollIntoViewIfNeeded();
  await second.scrollIntoViewIfNeeded();
  const a = (await first.boundingBox())!,
    b = (await second.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 2, { steps: 18 });
  await page.mouse.up();
  await expect(page.locator('.schedule-card h3').first()).toHaveText('海地獄を散策');
  await expect(
    page.getByText('並び順と時刻が前後しています。時刻は自動変更されません。'),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('.schedule-card h3').first()).toHaveText('海地獄を散策');
  await expect(page.locator('.time-column time').first()).toHaveText('11:00');
});

test('左スワイプは削除ボタンだけを表示し、削除を取り消せる', async ({ page }) => {
  await sample(page);
  const title = card(page, '別府駅に到着').getByRole('heading');
  await title.scrollIntoViewIfNeeded();
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 105, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(title).toBeVisible();
  await page.getByRole('button', { name: '別府駅に到着を削除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '別府駅に到着', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '取り消す', exact: true }).click();
  await expect(page.getByRole('heading', { name: '別府駅に到着', exact: true })).toBeVisible();
});

test('JSON書き出し・置換復元、不正ファイルで元データを守る', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'バックアップ', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'JSONをダウンロード' }).click();
  const download = await downloadEvent;
  const stream = (await download.createReadStream())!;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const json = Buffer.concat(chunks);
  const backup = JSON.parse(json.toString());
  expect(backup.data.schedules.length).toBe(4);
  await dialog.getByLabel('復元するJSONファイル').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(dialog.getByRole('alert')).toContainText('バックアップ形式');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.locator('.schedule-card')).toHaveCount(3);
  // Restore a valid modified file to verify replacement, not merely export.
  backup.data.trips[0].name = '復元した別府';
  await page.getByRole('button', { name: 'バックアップ', exact: true }).first().click();
  await dialog.getByLabel('復元するJSONファイル').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  page.once('dialog', (confirm) => confirm.accept());
  await dialog.getByRole('button', { name: 'このバックアップで置き換える' }).click();
  await expect(dialog.getByText('バックアップを復元しました。', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: /復元した別府の旅/ }).click();
  await expect(page.getByRole('heading', { name: '復元した別府の旅', exact: true })).toBeVisible();
  await expect(page.locator('.schedule-card')).toHaveCount(3);
});

test('タッチによる並び替えとスワイプ', async ({ page, context, browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'mobile-chromium',
    'Chromium CDPのタッチイベントを使用',
  );
  await sample(page);
  const client = await context.newCDPSession(page);
  async function touchDrag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= 18; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + ((to.x - from.x) * i) / 18, y: from.y + ((to.y - from.y) * i) / 18 },
        ],
      });
      await page.waitForTimeout(20);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const handles = page.locator('.drag-handle');
  await handles.nth(1).scrollIntoViewIfNeeded();
  const a = (await handles.nth(0).boundingBox())!,
    b = (await handles.nth(1).boundingBox())!;
  await touchDrag(
    { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { x: b.x + b.width / 2, y: b.y + b.height - 1 },
  );
  await expect(page.locator('.schedule-card h3').first()).toHaveText('海地獄を散策');
  const title = page.locator('.schedule-card h3').first();
  await title.scrollIntoViewIfNeeded();
  const box = (await title.boundingBox())!;
  await touchDrag(
    { x: box.x + box.width - 3, y: box.y + box.height / 2 },
    { x: box.x + box.width - 110, y: box.y + box.height / 2 },
  );
  await expect(page.getByRole('button', { name: '海地獄を散策を削除', exact: true })).toBeVisible();
  await expect(title).toBeVisible();
});

test('旅行の編集・日程短縮の保護・予定の日付移動・編集からの削除', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: '旅行を編集', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('旅行名').fill('のんびり別府');
  await dialog.getByRole('button', { name: '旅行を保存する' }).click();
  await expect(page.getByRole('heading', { name: 'のんびり別府の旅', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /DAY 3/ }).click();
  await addSchedule(page, '最後の温泉', '10:00', '11:00');
  await page.getByRole('button', { name: '旅行を編集', exact: true }).click();
  await dialog.getByLabel('終了日').fill('2026-11-02');
  await dialog.getByRole('button', { name: '旅行を保存する' }).click();
  await expect(dialog.getByRole('alert')).toContainText('日程から外れる予定');
  page.once('dialog', (confirm) => confirm.accept());
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '最後の温泉を編集' }).click();
  await dialog.getByLabel('日付').selectOption('2026-11-02');
  await dialog.getByRole('button', { name: '予定を保存する' }).click();
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: '最後の温泉', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '最後の温泉を編集' }).click();
  await dialog.getByRole('button', { name: 'この予定を削除する' }).click();
  await expect(page.getByRole('heading', { name: '最後の温泉', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '取り消す', exact: true }).click();
  await expect(page.getByRole('heading', { name: '最後の温泉', exact: true })).toBeVisible();
});

test('未保存の予定はブラウザの戻る操作でも確認し、キャンセル時は保持する', async ({ page }) => {
  await createTrip(page);
  await page.getByRole('button', { name: '予定を追加する' }).click();
  await page.getByRole('dialog').getByLabel('予定名・行先').fill('入力中の予定');
  page.once('dialog', (confirm) => confirm.dismiss());
  await page.goBack();
  await expect(page.getByRole('dialog').getByLabel('予定名・行先')).toHaveValue('入力中の予定');
  await expect(page).toHaveURL(/#\/trip\//);
});
