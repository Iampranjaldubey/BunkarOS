import { test, expect } from '@playwright/test';
import { setupAndLogin, istPrevMonth, attRow, markRadio, localRecords, synced, settled } from './fixtures';

/** SPEC-M14 AC1, AC2, AC4–AC9 and D-003 (A4 slip, WhatsApp text) on the real screens. Inputs: docs/wage-examples.md Example C. */
test('owner override (Example C), paid snapshot, A4 slip, WhatsApp link, and the four correction steps', async ({ page, browser }) => {
  test.setTimeout(150_000);
  const { d, month } = istPrevMonth();
  const goPrev = () => page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
  const openPay = async () => { await page.goto('/wages'); await goPrev(); await page.getByText('Rafiq').first().click(); await expect(page).toHaveURL(/\/wages\/\d{4}-\d{2}\//); };
  const payments = async () => (await localRecords(page)).filter((r) => r.type === 'wage_payment');

  await setupAndLogin(page);
  // Example A worker, overtime off (the default).
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByLabel(/कब से काम पर/).fill(d(1));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
  await page.goto('/advances/new');
  await page.getByLabel(/किसको/).selectOption({ label: 'Rafiq' });
  await page.getByLabel(/रकम/).fill('1000');
  await page.getByLabel('तारीख').fill(d(1));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹1,000');
  for (const [day, st] of [[d(1), 'A'], [d(2), 'A'], [d(3), 'H'], [d(4), 'P']] as const) {
    await page.goto('/attendance');
    await page.getByLabel('तारीख').fill(day);
    await markRadio(attRow(page, 'Rafiq'), st).click();
    await expect(markRadio(attRow(page, 'Rafiq'), st)).toHaveAttribute('aria-checked', 'true');
  }

  // AC5 of M02 first: ₹9,846 computed.
  await openPay();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹9,846');

  // AC2: the override needs a reason. AC1: absence deduction ₹923.08 → ₹500.
  await page.getByTestId('line-absent_deduct').getByRole('button', { name: /बदलें/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('override-computed')).toHaveText('₹923.08');
  await sheet.getByLabel(/नई रकम/).fill('500');
  await expect(sheet.getByTestId('override-save')).toBeDisabled();
  await sheet.getByLabel(/बदलने की वजह/).fill('एक दिन की छुट्टी दी थी');
  await sheet.getByTestId('override-save').click();
  await expect(page.getByTestId('line-absent_deduct')).toContainText('−₹500');
  await expect(page.getByTestId('line-absent_deduct').getByTestId('computed-amount')).toHaveText('−₹923.08');
  await expect(page.getByTestId('line-absent_deduct').getByTestId('owner-changed')).toBeVisible();
  await expect(page.getByTestId('line-absent_deduct').getByTestId('override-reason')).toContainText('एक दिन की छुट्टी दी थी');
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,269');

  // AC4: an override that makes net negative blocks the payment in the app.
  await page.getByTestId('line-base').getByRole('button', { name: /बदलें/ }).click();
  await sheet.getByLabel(/नई रकम/).fill('0');
  await sheet.getByLabel(/बदलने की वजह/).fill('जाँच');
  await sheet.getByTestId('override-save').click();
  await expect(page.getByTestId('negative-net')).toBeVisible();
  await expect(page.getByRole('button', { name: /भुगतान पक्का करें/ })).toBeDisabled();
  await page.getByTestId('line-base').getByRole('button', { name: /बदलें/ }).click();
  await sheet.getByRole('button', { name: /हिसाब वाली रकम वापस लें/ }).click();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,269');

  // Pay. The stored payment carries the override and Example C's amounts.
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await page.getByRole('button', { name: /भुगतान पक्का करें/ }).click();
  await expect(page.getByText(/को दिया/)).toBeVisible();
  const [p1] = await payments();
  expect(p1.payload).toMatchObject({ grossPaise: 1_126_923, netPaise: 1_026_923, roundingPaise: -23, paidPaise: 1_026_900,
    overrides: [{ line: 'absent_deduct', computedPaise: 92_308, finalPaise: 50_000, reason: 'एक दिन की छुट्टी दी थी' }] });

  // AC9 + snapshot: the paid page has no "बदलें" and shows the saved lines, including the change.
  await page.reload();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,269');
  await expect(page.getByTestId('wage-lines').getByRole('button', { name: /बदलें/ })).toHaveCount(0);
  await expect(page.getByTestId('line-absent_deduct').getByTestId('computed-amount')).toHaveText('−₹923.08');
  // AC6: the worker's salary did not change.
  const worker = (await localRecords(page)).filter((r) => r.type === 'worker').at(-1)!;
  expect(worker.payload.salaryPaise).toBe(1_200_000);

  // D-003: the printed slip is one A4 page with the 8 default sections and the non-zero Rounding row.
  await page.emulateMedia({ media: 'print' });
  const paper = page.getByTestId('slip-paper');
  await expect(paper).toBeVisible();
  await expect(page.getByTestId('wage-breakdown')).toBeHidden();
  const box = (await paper.boundingBox())!;
  expect(Math.round(box.width)).toBe(794);   // 210 mm at 96 dpi
  expect(Math.round(box.height)).toBe(1123); // 297 mm
  const rows = await page.getByTestId('slip-paper-rows').innerText();
  for (const s of ['कुल कमाई', '₹11,269.23', 'कटौती', 'एडवांस काटा', '−₹1,000', 'राउंडिंग', '−₹0.23', 'दिया', '₹10,269']) expect(rows).toContain(s);
  for (const s of ['हाज़िर', 'पीस', 'ओवरटाइम']) expect(rows).not.toContain(s);
  await expect(page.getByTestId('slip-paper-signature')).toBeVisible();
  await expect(paper).toContainText('Rafiq');
  if (test.info().project.name === 'desktop') {
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect(pdf.match(/\/Type\s*\/Page\b/g)?.length).toBe(1);
    const media = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(media, 'MediaBox').toBeTruthy();
    expect([Math.round(Number(media![1])), Math.round(Number(media![2]))]).toEqual([595, 842]); // A4 = 210 × 297 mm in points
  }
  await page.emulateMedia({ media: 'screen' });

  // WhatsApp text: the same fields plus the worker-page link.
  await synced(page);
  await page.getByRole('button', { name: /^पर्ची$/ }).click();
  const share = page.getByRole('dialog');
  await expect(share).toContainText(/अपना पूरा हिसाब यहाँ देखें: https?:\/\/\S+\/w\/[A-Za-z0-9_-]+/);
  for (const s of ['Rafiq', 'कुल कमाई: ₹11,269.23', 'कटौती: ₹0', 'एडवांस काटा: −₹1,000', 'राउंडिंग: −₹0.23', 'दिया: ₹10,269']) await expect(share).toContainText(s);
  const link = ((await share.textContent()) ?? '').match(/https?:\/\/\S+\/w\/[A-Za-z0-9_-]+/)![0];
  await page.keyboard.press('Escape');

  // AC7: lock, then the four correction steps, each with a reason.
  await page.goto('/wages'); await goPrev();
  await page.getByRole('button', { name: /महीना लॉक करें/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByText(/महीना लॉक है/).first()).toBeVisible();
  await page.getByText('Rafiq').first().click();
  await expect(page.getByTestId('change-paid')).toContainText('पहले पगार शीट पर महीना खोलें');
  await expect(page.getByTestId('change-paid').getByRole('button', { name: /भुगतान वापस लें/ })).toHaveCount(0);
  // Step 1: unlock with a reason (AC8: no reason → cannot confirm).
  await page.goto('/wages'); await goPrev();
  await page.getByRole('button', { name: /महीना खोलें/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ })).toBeDisabled();
  await page.getByRole('dialog').getByLabel(/महीना खोलने की वजह/).fill('पगार दोबारा देनी है');
  await page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByRole('button', { name: /महीना लॉक करें/ })).toBeVisible();
  // Step 2: reverse the payment with a reason.
  await page.getByText('Rafiq').first().click();
  await page.getByTestId('change-paid').getByRole('button', { name: /भुगतान वापस लें/ }).click();
  const rev = page.getByRole('dialog');
  await expect(rev.getByRole('button', { name: /भुगतान वापस लें/ })).toBeDisabled();
  await rev.getByLabel(/वापस लेने की वजह/).fill('छुट्टी का दिन ग़लत लगा');
  await rev.getByRole('button', { name: /भुगतान वापस लें/ }).click();
  // Step 3: pay again with a correction reason and a new override (half day counted in full).
  await expect(page.getByTestId('correction-reason')).toBeVisible();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹9,846'); // overrides start fresh
  await page.getByTestId('line-half_deduct').getByRole('button', { name: /बदलें/ }).click();
  await sheet.getByLabel(/नई रकम/).fill('0');
  await sheet.getByLabel(/बदलने की वजह/).fill('आधा दिन पूरा माना');
  await sheet.getByTestId('override-save').click();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,077'); // 12,000 − 923.08 − 0 − 1,000 → ₹10,076.92 → ₹10,077
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await expect(page.getByRole('button', { name: /भुगतान पक्का करें/ })).toBeDisabled(); // AC8: correction reason required
  await page.getByTestId('correction-reason').fill('सही छुट्टी के साथ');
  await page.getByRole('button', { name: /भुगतान पक्का करें/ }).click();
  await expect(page.getByText(/को दिया/)).toBeVisible();
  // Step 4: lock again with a reason (required because the month was locked before).
  await page.goto('/wages'); await goPrev();
  await page.getByRole('button', { name: /महीना लॉक करें/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ })).toBeDisabled();
  await page.getByRole('dialog').getByLabel(/लॉक करने की वजह/).fill('सुधार पूरा');
  await page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByText(/महीना लॉक है/).first()).toBeVisible();
  // Every record reached the server (none rejected).
  expect(await settled(page)).toEqual([]);
  expect((await localRecords(page)).filter((r) => r.sync !== 'synced').map((r) => `${r.type} ${(r as { rejectReason?: string }).rejectReason ?? r.sync} ${String(r.payload.reason ?? r.payload.correctionReason ?? r.payload.month ?? '')} ${(r as { at?: string }).at}`)).toEqual([]);

  // AC5 + AC7: the log shows the override, and the four steps in order (newest first), the reversed payment struck through.
  await page.goto('/log');
  await expect(page.locator('main')).toContainText('वजह: पगार दोबारा देनी है');
  const log = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(log).toContain('बदला: ग़ैरहाज़िरी की कटौती −₹923.08 → −₹500 (एक दिन की छुट्टी दी थी)');
  const at = (s: string) => { const i = log.indexOf(s); expect(i, s).toBeGreaterThanOrEqual(0); return i; };
  const relock = at('वजह: सुधार पूरा');
  const repay = at('दोबारा भुगतान: सही छुट्टी के साथ');
  const reversed = at('वजह: छुट्टी का दिन ग़लत लगा');
  const unlocked = at('वजह: पगार दोबारा देनी है');
  expect(relock).toBeLessThan(repay);
  expect(repay).toBeLessThan(reversed);
  expect(reversed).toBeLessThan(unlocked);
  await expect(page.locator('.line-through', { hasText: '₹10,269' })).toHaveCount(1);
  expect(log).toContain('बदला: आधे दिन की कटौती −₹230.77 → ₹0 (आधा दिन पूरा माना)');

  // Worker's own page: only the new payment, its changed line marked.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const wp = await phone.newPage();
  await wp.goto(link);
  await expect(wp.getByRole('heading', { name: /नमस्ते, Rafiq/ })).toBeVisible();
  await wp.getByRole('tab', { name: /^पगार$/ }).click();
  await expect(wp.getByTestId(`year-total-${month.slice(0, 4)}`)).toHaveText('₹10,077');
  await expect(wp.getByText('₹10,269')).toHaveCount(0);
  await wp.getByRole('button', { name: /को मिला/ }).first().click();
  await expect(wp.getByTestId('wp-owner-changed')).toHaveCount(1);
  await phone.close();

  // SPEC-M02 AC9: attendance summary on, signature line off → the next printed slip follows; the change is in the log.
  await page.goto('/settings');
  const sections = page.getByTestId('slip-sections');
  await sections.getByRole('checkbox', { name: /हाज़िरी का जोड़/ }).check();
  await sections.getByRole('checkbox', { name: /दस्तख़त की जगह/ }).uncheck();
  await page.getByTestId('save-rules').click();
  await expect(page.getByTestId('save-rules')).toBeDisabled();
  await openPay();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('slip-paper-rows')).toContainText('हाज़िरी');
  await expect(page.getByTestId('slip-paper-rows')).toContainText('P 1 · H 1 · A 2');
  await expect(page.getByTestId('slip-paper-signature')).toHaveCount(0);
  await page.emulateMedia({ media: 'screen' });
  await page.goto('/log');
  await expect(page.locator('main')).toContainText('पर्ची में क्या छपे: −दस्तख़त की जगह, +हाज़िरी का जोड़');
});

