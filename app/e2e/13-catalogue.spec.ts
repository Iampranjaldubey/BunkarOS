import { test, expect, type Locator, type Page } from '@playwright/test';
import { setupAndLogin, istToday, istPrevMonth, localRecords, localPhotos, injectPending, noisyPng, settled, synced, setPerms, addStaffLogin, operatorDevice, afterSync } from './fixtures';

const png = (name: string, w = 64, h = 48) => ({ name, mimeType: 'image/png', buffer: noisyPng(w, h) });
const dialog = (page: Page) => page.getByRole('dialog');
/** Pick the <option> whose text contains `text`. */
async function pick(select: Locator, text: string) {
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value!);
}

async function newCarpet(page: Page, c: { design: string; length: string; width: string; qty?: string; tag?: string; price?: string; cost?: string; photos?: { name: string; mimeType: string; buffer: Buffer }[]; expectError?: boolean }) {
  await page.goto('/catalogue/new');
  await expect(page.getByTestId('carpet-form')).toBeVisible();
  if (c.photos?.length) await page.getByTestId('photo-list-input').setInputFiles(c.photos);
  await page.getByLabel(/^डिज़ाइन \(नाम या कोड\)/).fill(c.design);
  await page.getByLabel(/^लंबाई/).fill(c.length);
  await page.getByLabel(/^चौड़ाई/).fill(c.width);
  if (c.tag !== undefined) { await page.getByRole('radio', { name: 'एक पीस (टैग के साथ)' }).click(); await page.getByLabel(/^पीस टैग/).fill(c.tag); }
  else if (c.qty) await page.getByLabel(/^कितने कालीन/).fill(c.qty);
  if (c.cost) await page.getByLabel(/^लागत/).fill(c.cost);
  if (c.price) await page.getByLabel(/^बेचने का भाव/).fill(c.price);
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  if (!c.expectError) await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/); // saved: the carpet's own page
}
async function newOrder(page: Page, qty: number, buyer = 'Sharma Exports') {
  await page.goto('/orders/new');
  const existing = await page.getByLabel(/^खरीदार/).locator('option', { hasText: buyer }).count();
  if (existing) await pick(page.getByLabel(/^खरीदार/), buyer);
  else {
    await page.getByRole('button', { name: /नया खरीदार/ }).click();
    await dialog(page).getByLabel(/नाम \/ फर्म/).fill(buyer);
    await dialog(page).getByRole('button', { name: /सेव करें/ }).click();
    await expect(dialog(page)).toHaveCount(0);
  }
  await expect(page.getByLabel(/^खरीदार/)).toHaveValue(/.+/);
  const orderNo = await page.getByLabel(/ऑर्डर नंबर/).inputValue();
  await page.getByLabel(/^डिज़ाइन/).fill('Kashan');
  await page.getByLabel(/साइज़/).fill('8x10');
  await page.getByLabel(/कितने कालीन/).fill(String(qty));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
  return { orderNo, url: new URL(page.url()).pathname };
}
async function openCarpet(page: Page, text: string, statuses?: string[]) {
  await page.goto('/catalogue');
  if (statuses) await showStatuses(page, statuses);
  await page.getByTestId('catalogue-grid').getByTestId('carpet-card').filter({ hasText: text }).first().click();
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
}
/** Open the filter panel (a sheet on phones) and set exactly these status checkboxes. */
async function withFilters(page: Page, fn: (f: Locator) => Promise<void>) {
  await expect(page.getByTestId('catalogue-count')).toBeVisible();
  const phone = await page.getByTestId('open-filters').isVisible();
  if (phone) await page.getByTestId('open-filters').click();
  const f = page.getByTestId('catalogue-filters');
  await fn(f);
  if (phone) await dialog(page).getByRole('button').last().click();
}
async function showStatuses(page: Page, statuses: string[]) {
  await withFilters(page, async (f) => {
    for (const s of ['in_stock', 'reserved', 'delivered', 'sold', 'written_off']) await f.getByTestId(`filter-status-${s}`).setChecked(statuses.includes(s));
  });
}
const counts = async (page: Page) => Object.fromEntries(await Promise.all(['in-stock', 'reserved', 'delivered', 'sold', 'written-off', 'added'].map(async (k) => [k, Number((await page.getByTestId(`count-${k}`).innerText()).replace(/\D+/g, ' ').trim().split(' ').at(-1))])));
/** A move on the carpet page: reserve / deliver / sold / written off / add more. */
async function move(page: Page, button: string, o: { order?: string; qty: number; note?: string; day?: string }) {
  await page.getByRole('button', { name: button, exact: true }).first().click();
  const d = dialog(page);
  if (o.order) await pick(d.getByTestId('move-order'), o.order);
  await d.getByTestId('move-qty').fill(String(o.qty));
  if (o.day) await d.getByLabel('तारीख').fill(o.day);
  if (o.note !== undefined) await d.getByTestId('move-note').fill(o.note);
  await d.getByTestId('move-save').click();
}

/** AC1, AC2, AC3 (app), AC9: offline add with 4 → 3 compressed photos, grid cover and count, queued upload on reconnect. */
test('catalogue: add offline with photos (max 4, ≤ 1280 px, ≤ 300 KB), grid shows cover + "5 in stock", photos upload when back online', async ({ page, context }) => {
  test.setTimeout(120_000);
  await setupAndLogin(page);
  await page.goto('/catalogue');
  await expect(page.getByText('कैटलॉग में अभी कोई कालीन नहीं')).toBeVisible();
  await page.goto('/catalogue/new');
  await expect(page.getByTestId('carpet-form')).toBeVisible();
  await synced(page);
  // The built PWA precaches every screen; the Vite dev server used by the tests does not, so load them while online.
  await page.evaluate(async () => { for (const m of ['/src/features/catalogue/CarpetDetailPage.tsx', '/src/features/catalogue/CataloguePage.tsx']) await import(/* @vite-ignore */ m); });

  await context.setOffline(true);
  // AC2: five photos picked → only four are kept and "add photo" disappears.
  await page.getByTestId('photo-list-input').setInputFiles([png('a.png', 2400, 1600), png('b.png'), png('c.png'), png('d.png'), png('e.png')]);
  await expect(page.getByTestId('photo-list-item')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /फ़ोटो जोड़ें/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'फ़ोटो 4 हटाएँ' }).click();
  await expect(page.getByTestId('photo-list-item')).toHaveCount(3);
  await page.getByLabel(/^डिज़ाइन \(नाम या कोड\)/).fill('Kashan 101');
  await page.getByLabel(/^लंबाई/).fill('8');
  await page.getByLabel(/^चौड़ाई/).fill('10');
  await page.getByLabel(/^कितने कालीन/).fill('5');
  await page.getByLabel(/^लागत/).fill('30000');
  await page.getByLabel(/^बेचने का भाव/).fill('45000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 5, added: 5 });

  // Saved on the phone while offline: the carpet, its 5 added and 3 photos all wait to sync.
  const pending = (await localRecords(page)).filter((r) => r.sync === 'pending').map((r) => r.type).sort();
  expect(pending).toEqual(['carpet', 'carpet_in']);
  const carpetRec = (await localRecords(page)).find((r) => r.type === 'carpet')!;
  const ids = carpetRec.payload.photoIds as string[];
  expect(ids).toHaveLength(3);
  // AC9: JPEG, longest edge ≤ 1280 px, ≤ 300 KB (the first one came from a 2400 × 1600 noisy picture).
  const photos = (await localPhotos(page)).filter((p) => ids.includes(p.id));
  expect(photos.map((p) => p.sync)).toEqual(['pending', 'pending', 'pending']);
  for (const p of photos) { expect(p.mime).toBe('image/jpeg'); expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(1280); expect(p.size).toBeLessThanOrEqual(300 * 1024); }
  const big = photos.find((p) => p.id === ids[0])!;
  expect(Math.max(big.w, big.h)).toBeGreaterThan(300); // shrunk, not a thumbnail

  // AC1: the grid shows the cover photo and "5 स्टॉक में"; the price is shown to the owner. (Still offline: in-app navigation.)
  await page.getByRole('button', { name: 'वापस', exact: true }).first().click();
  await expect(page).toHaveURL(/\/catalogue$/);
  const card = page.getByTestId('carpet-card').filter({ hasText: 'Kashan 101' });
  await expect(card.getByTestId('carpet-status')).toHaveText('5 स्टॉक में');
  await expect(card.getByTestId('carpet-photo')).toHaveAttribute('src', /^blob:/);
  await expect(card.getByTestId('carpet-price')).toHaveText('₹45,000');
  await expect(card).toContainText('8 × 10 ft');

  // Back online: records and the queued photos reach the server.
  await context.setOffline(false);
  expect(await settled(page)).toEqual([]);
  await expect.poll(async () => (await localPhotos(page)).filter((p) => ids.includes(p.id)).map((p) => p.sync).join(','), { timeout: 20_000 }).toBe('synced,synced,synced');

  // AC3 in the app: a piece tag can be used once.
  await newCarpet(page, { design: 'Bokhara', length: '6', width: '9', tag: 'BH-0042' });
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  await newCarpet(page, { design: 'Bokhara', length: '6', width: '9', tag: 'bh-0042', expectError: true });
  await expect(page.getByText('यह टैग पहले से किसी और कालीन पर है')).toBeVisible();
  await expect(page).toHaveURL(/\/catalogue\/new$/);
});

/** AC4–AC7, AC10–AC15 on the real screens. */
test('catalogue: reserve, deliver, filters, sold directly, written off, limits, release, undo, locked month, legacy finished items', async ({ page }) => {
  test.setTimeout(180_000);
  await setupAndLogin(page);
  const today = istToday();
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  await newCarpet(page, { design: 'Kashan 101', length: '8', width: '10', qty: '5', price: '45000', photos: [png('k.png')] });
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  const kashanUrl = new URL(page.url()).pathname;
  const ord1 = await newOrder(page, 4);

  // AC4: reserve 3 for ORD-001 → in stock 2, reserved 3; 2 more is refused (the order needs 1).
  await page.goto(kashanUrl);
  await move(page, 'ऑर्डर के लिए रखें', { order: ord1.orderNo, qty: 3 });
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 2, reserved: 3 });
  await move(page, 'ऑर्डर के लिए रखें', { order: ord1.orderNo, qty: 2 });
  await expect(dialog(page).getByRole('alert')).toHaveText('ऑर्डर को सिर्फ़ 1 और चाहिए');
  await expect(dialog(page).getByTestId('order-needs')).toHaveText('इस ऑर्डर को अभी 1 और चाहिए');
  await page.keyboard.press('Escape');

  // AC5: from the order page, deliver 2 from the catalogue → reserved 1, delivered 2, order 2/4, pending 2, status unchanged; 3 more refused.
  await page.goto(ord1.url);
  await page.getByRole('button', { name: 'कैटलॉग से डिलीवर करें' }).click();
  await pick(dialog(page).getByTestId('order-cat-carpet'), 'Kashan 101');
  await expect(dialog(page).getByTestId('order-cat-carpet').locator('option:checked')).toContainText('रखे 3');
  await dialog(page).getByTestId('order-cat-qty').fill('2');
  await dialog(page).getByTestId('order-cat-save').click();
  await expect(page.getByTestId('order-delivered')).toContainText('2/4');
  await expect(page.getByTestId('order-pending')).toContainText('2');
  await expect(page.getByText('नया', { exact: true }).first()).toBeVisible(); // status unchanged
  await expect(page.getByTestId('order-catalogue')).toContainText('कैटलॉग से: 1 रखे · 2 डिलीवर');
  await page.getByRole('button', { name: 'कैटलॉग से डिलीवर करें' }).click();
  await pick(dialog(page).getByTestId('order-cat-carpet'), 'Kashan 101');
  await dialog(page).getByTestId('order-cat-qty').fill('3');
  await dialog(page).getByTestId('order-cat-save').click();
  await expect(dialog(page).getByRole('alert')).toHaveText('ऑर्डर को सिर्फ़ 2 और चाहिए');
  await page.keyboard.press('Escape');
  await page.goto(kashanUrl);
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 2, reserved: 1, delivered: 2 });

  // AC6: piece BH-0042 reserved for the order, then delivered → status delivered, hidden by default, shown with "delivered".
  await newCarpet(page, { design: 'Bokhara', length: '6', width: '9', tag: 'BH-0042', price: '20000' });
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  await move(page, 'ऑर्डर के लिए रखें', { order: ord1.orderNo, qty: 1 });
  await expect(page.getByTestId('carpet-status')).toHaveText('ऑर्डर के लिए रखा');
  await move(page, 'डिलीवर करें', { order: ord1.orderNo, qty: 1 });
  await expect(page.getByTestId('carpet-status')).toHaveText('डिलीवर हुआ');
  await page.goto('/catalogue');
  const grid = page.getByTestId('catalogue-grid');
  await expect(grid.getByTestId('carpet-card')).toHaveCount(1);
  await showStatuses(page, ['in_stock', 'reserved', 'delivered']);
  await expect(grid.getByTestId('carpet-card').filter({ hasText: 'BH-0042' })).toBeVisible();

  // AC7: search "kashan" + size 8 × 10 finds Kashan 101; "reserved" shows only carpets with a reservation; price range.
  await newCarpet(page, { design: 'Nain', length: '5', width: '8', qty: '2', price: '15000' });
  await page.goto('/catalogue');
  await page.getByTestId('catalogue-search').fill('kashan');
  await expect(grid.getByTestId('carpet-card')).toHaveCount(1);
  await withFilters(page, async (f) => { await f.getByTestId('filter-size').selectOption({ label: '8 × 10 ft' }); });
  await expect(grid.getByTestId('carpet-card').filter({ hasText: 'Kashan 101' })).toHaveCount(1);
  await page.getByTestId('catalogue-search').fill('');
  await withFilters(page, async (f) => { await f.getByTestId('filter-size').selectOption(''); });
  await expect(grid.getByTestId('carpet-card')).toHaveCount(2); // Kashan 101 + Nain
  await showStatuses(page, ['reserved']);
  await expect(grid.getByTestId('carpet-card')).toHaveCount(1);
  await expect(grid.getByTestId('carpet-card')).toContainText('Kashan 101');
  await showStatuses(page, ['in_stock', 'reserved']);
  await withFilters(page, async (f) => { await f.getByTestId('filter-price-max').fill('20000'); await f.getByTestId('filter-design').selectOption('Nain'); });
  await expect(grid.getByTestId('carpet-card')).toHaveCount(1);
  await expect(grid.getByTestId('carpet-card')).toContainText('Nain');

  // AC11: sold directly 1, dated yesterday, note → in stock 1, sold 1; no order.
  await page.goto(kashanUrl);
  await move(page, 'सीधे बेचा', { qty: 1, day: yesterday, note: 'दुकान पर बेचा' });
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 1, sold: 1, reserved: 1 });
  // AC13: no note → refused; 2 when 1 is in stock → refused.
  await move(page, 'सीधे बेचा', { qty: 1, note: '' });
  await expect(dialog(page).getByRole('alert')).toHaveText('नोट ज़रूरी है');
  await page.keyboard.press('Escape');
  await move(page, 'सीधे बेचा', { qty: 2, note: 'x' });
  await expect(dialog(page).getByRole('alert')).toHaveText('स्टॉक में सिर्फ़ 1 हैं (रखे हुए पहले छोड़ें)');
  await page.keyboard.press('Escape');
  // AC12: written off 1 → in stock 0, written off 1.
  await move(page, 'बट्टे खाते में डालें', { qty: 1, note: 'पानी से ख़राब' });
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 0, 'written-off': 1, reserved: 1 });
  // AC13: the reserved carpet cannot be sold until released (no stock left → the buttons are off).
  await expect(page.getByRole('button', { name: 'सीधे बेचा', exact: true })).toBeDisabled();

  // AC14: undo the sale with a reason → in stock +1, sold −1; history keeps both.
  await page.getByRole('button', { name: /एंट्री वापस लें: 1 सीधे बेचे/ }).click();
  await expect(page.getByTestId('undo-save')).toBeDisabled();
  await dialog(page).getByTestId('undo-reason').fill('ग़लती से दर्ज');
  await page.getByTestId('undo-save').click();
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 1, sold: 0 });
  await expect(page.getByTestId('carpet-history')).toContainText('वापस लिया: ग़लती से दर्ज');

  // AC10: release the reservation with a reason → back in stock.
  await page.getByTestId('carpet-reservations').getByRole('button', { name: /ORD-001 के लिए रखे 1 छोड़ें/ }).click();
  await dialog(page).getByTestId('undo-reason').fill('ऑर्डर बदला');
  await page.getByTestId('undo-save').click();
  await expect.poll(() => counts(page)).toMatchObject({ 'in-stock': 2, reserved: 0, delivered: 2 });
  await expect(page.getByTestId('carpet-reservations')).toHaveCount(0);

  // AC12: piece BH-0043 written off → status written off, hidden by default, shown with "written off".
  await newCarpet(page, { design: 'Bokhara', length: '6', width: '9', tag: 'BH-0043' });
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  await move(page, 'बट्टे खाते में डालें', { qty: 1, note: 'फटा हुआ' });
  await expect(page.getByTestId('carpet-status')).toHaveText('बट्टे खाते में');
  await page.goto('/catalogue');
  await expect(grid.getByTestId('carpet-card').filter({ hasText: 'BH-0043' })).toHaveCount(0);
  await showStatuses(page, ['written_off']);
  await expect(grid.getByTestId('carpet-card')).toHaveCount(2); // Kashan 101 (1 written off) + BH-0043
  await expect(grid.getByTestId('carpet-card').filter({ hasText: 'BH-0043' })).toBeVisible();

  // Everything above was accepted by the server.
  expect(await settled(page)).toEqual([]);

  // AC10, AC11, AC14: the entry log shows the sale with its date and note, the undo, and the release.
  await page.goto('/log');
  const log = page.locator('main');
  await expect(log).toContainText('Kashan 101 · 1 सीधे बेचे · दुकान पर बेचा');
  await expect(log).toContainText('वापस लिया: Kashan 101 · 1 सीधे बेचे · वजह: ग़लती से दर्ज');
  await expect(log).toContainText(`रखा हुआ छोड़ा: Kashan 101 · ${ord1.orderNo} · वजह: ऑर्डर बदला`);
  await expect(log).toContainText('Kashan 101 · 1 बट्टे खाते में · पानी से ख़राब');

  // AC13: sold or written off dated inside a locked month is refused in the app.
  const { d: prevDay } = istPrevMonth();
  const lockedMonth = (() => { const [y, m] = prevDay(1).slice(0, 7).split('-').map(Number); const dt = new Date(Date.UTC(y, m - 2, 1)); return dt.toISOString().slice(0, 7); })();
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByLabel(/कब से काम पर/).fill(`${lockedMonth}-01`);
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
  await page.goto('/wages');
  for (let i = 0; i < 2; i++) await page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
  await page.getByRole('button', { name: /महीना लॉक करें/ }).click();
  await dialog(page).getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByText(/महीना लॉक है/).first()).toBeVisible();
  await page.goto(kashanUrl);
  await move(page, 'सीधे बेचा', { qty: 1, day: `${lockedMonth}-15`, note: 'पुरानी बिक्री' });
  await expect(dialog(page).getByRole('alert')).toHaveText('यह महीना लॉक है — मालिक से खुलवाएँ');
  await page.keyboard.press('Escape');

  // AC15 legacy: the item form offers no "finished" kind; an old finished item keeps its balance, is labelled "पुराना",
  // and can still be delivered against an order.
  await page.goto('/stock/new');
  await expect(page.getByTestId('item-kind-raw')).toBeVisible();
  await expect(page.getByRole('radio', { name: /तैयार कालीन/ })).toHaveCount(0);
  await injectPending(page, 'item', { entityId: 'legacy-kashan', name: 'Kashan 8x10', kind: 'finished', unit: 'pcs', lowStockQty: 0, active: true });
  await injectPending(page, 'finished_in', { itemId: 'legacy-kashan', qty: 3000 });
  await page.reload();
  expect(await settled(page)).toEqual([]);
  await page.goto('/stock');
  const row = page.getByText('Kashan 8x10').first().locator('xpath=ancestor::*[self::a or self::tr][1]');
  await expect(row).toContainText('पुराना');
  await expect(page.getByTestId('stock-catalogue-link')).toBeVisible();
  await page.goto('/stock/legacy-kashan');
  await expect(page.getByRole('heading', { name: 'Kashan 8x10 · पुराना' })).toBeVisible();
  await expect(page.getByTestId('item-balance')).toContainText('3');
  await page.goto('/stock/legacy-kashan/edit');
  await expect(page.getByTestId('item-legacy')).toContainText('पुराना');
  const ord2 = await newOrder(page, 2);
  await page.getByRole('button', { name: 'डिलीवर करें', exact: true }).click();
  await dialog(page).getByLabel(/कितने दिए/).fill('1');
  await pick(dialog(page).getByLabel(/तैयार स्टॉक से घटाएँ/), 'Kashan 8x10');
  await dialog(page).getByRole('button', { name: 'डिलीवर करें', exact: true }).click();
  await expect(page.getByTestId('order-delivered')).toContainText('1/2');
  expect(ord2.orderNo).toBe('ORD-002');
  await page.goto('/stock/legacy-kashan');
  await expect(page.getByTestId('item-balance')).toContainText('2');
  expect(await settled(page)).toEqual([]);
});

/** AC8 + criterion 5 on the screens: "see prices" off → an operator sees no cost or price; the owner still does. Photos load on another phone. */
test('catalogue: operator sees photos from another phone; with "see prices" off no cost or price reaches the operator', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await setupAndLogin(page);
  await addStaffLogin(page, 'Munshi Ji', '2222');
  await newCarpet(page, { design: 'Kashan 101', length: '8', width: '10', qty: '5', cost: '30000', price: '45000', photos: [png('k.png', 800, 600)] });
  await expect(page).toHaveURL(/\/catalogue\/(?!new)[^/]+$/);
  const kashanUrl = new URL(page.url()).pathname;
  await page.goto('/settings');
  const unitId = (await page.getByTestId('join-unit-id').textContent())!.trim();
  const unitKey = (await page.getByTestId('join-unit-key').textContent())!.trim();
  expect(await settled(page)).toEqual([]);
  await expect.poll(async () => (await localPhotos(page)).every((p) => p.sync === 'synced'), { timeout: 20_000 }).toBe(true);

  const { ctx, op } = await operatorDevice(browser, page, unitId, unitKey, 'Munshi Ji', '2222');
  // The photo was taken on the owner's phone: the operator's phone fetches it from the server.
  await op.goto('/catalogue');
  const card = op.getByTestId('carpet-card').filter({ hasText: 'Kashan 101' });
  await expect(card.getByTestId('carpet-photo')).toHaveAttribute('src', /^blob:/, { timeout: 15_000 });
  await expect(card.getByTestId('carpet-price')).toHaveText('₹45,000'); // prices visible by default (D-005)

  // Owner hides prices → the operator's phone resyncs and holds no cost or price anywhere.
  await setPerms(page, { seePrices: false });
  await synced(page);
  await afterSync(op, async () => {
    const carpets = (await localRecords(op)).filter((r) => r.type === 'carpet');
    expect(carpets.length).toBeGreaterThan(0);
    expect(carpets.every((r) => !('pricePaise' in r.payload) && !('costPaise' in r.payload))).toBe(true);
  });
  await op.goto('/catalogue');
  await expect(card).toBeVisible();
  await expect(op.getByTestId('carpet-price')).toHaveCount(0);
  await expect(op.getByTestId('filter-price-min')).toHaveCount(0);
  await op.goto(kashanUrl);
  await expect(op.getByTestId('carpet-size')).toHaveText('8 × 10 ft');
  await expect(op.getByTestId('carpet-prices')).toHaveCount(0);
  await expect(op.locator('main')).not.toContainText('45,000');
  // The operator edits the notes: no price field, and the stored prices stay for the owner.
  await op.goto(`${kashanUrl}/edit`);
  await expect(op.getByLabel(/^बेचने का भाव/)).toHaveCount(0);
  await expect(op.getByLabel(/^लागत/)).toHaveCount(0);
  await op.getByLabel(/^नोट/).fill('ऑपरेटर का नोट');
  await op.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(op).toHaveURL(new RegExp(`${kashanUrl}$`));
  expect(await settled(op)).toEqual([]);
  await afterSync(page, async () => {
    const latest = (await localRecords(page)).filter((r) => r.type === 'carpet').map((r) => r.payload).find((p) => p.notes === 'ऑपरेटर का नोट');
    expect(latest).toMatchObject({ pricePaise: 4_500_000, costPaise: 3_000_000 });
  });
  await page.goto(kashanUrl);
  await expect(page.getByTestId('carpet-prices')).toContainText('₹45,000');
  await expect(page.getByTestId('carpet-prices')).toContainText('₹30,000');
  await ctx.close();
});
