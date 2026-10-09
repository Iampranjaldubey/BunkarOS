// Bunkar OS — E2E 12: Round-3 UI/UX fix (docs/reviews/round3-ui-ux.md B1).
// The roker (owner's primary cash ledger) must NOT render raw English + a
// 36-char UUID or a raw head-enum key as an entry label. Labels must be
// name-resolved and fully i18n'd in BOTH Hindi and English.
//
// The demo seeds exactly two auto/manual roker entries on TODAY's IST day:
//   • a peshgi of ₹2,000 (cash) to thekedar "Salim"  → was "Peshgi thekedar <uuid>"
//   • a manual roker entry head=dyer note="रंगाई भुगतान" → was "dyer: रंगाई भुगतान"
// so /roker on today exercises both the peshgi name-resolution and the head
// translation branches of the fix (RokerPage.tsx entryLabel).
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal } from './fixtures';

// A v4 UUID anywhere in a label is the exact defect we are preventing.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Text of every roker entry label on the current day. */
async function entryLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const items = page.locator('ul > li');
  const n = await items.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(((await items.nth(i).innerText()) ?? '').trim());
  }
  return out;
}

test.describe('12 round-3 roker labels (B1)', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('Hindi: peshgi resolves to the thekedar name, head is translated, no UUID', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Ansari Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await page.goto(`${APP}/roker`);

    // Entries list present (today has the two seeded cash movements).
    const closing = page.getByTestId('roker-closing');
    await expect(closing).toBeVisible();

    const labels = await entryLabels(page);
    expect(labels.length).toBeGreaterThan(0);

    // No raw UUID anywhere in the ledger.
    for (const l of labels) expect(l, `label "${l}" must not contain a UUID`).not.toMatch(UUID_RE);
    // No raw head-enum key leaking through as a prefix.
    expect(labels.join('\n')).not.toMatch(/\bdyer\b/);

    // Peshgi row → "पेशगी · Salim" (name resolved, Hindi head word).
    expect(labels.some((l) => l.includes('पेशगी') && l.includes('Salim'))).toBe(true);
    // Dyer manual entry → "रंगाई: रंगाई भुगतान" (translated head + note).
    expect(labels.some((l) => l.includes('रंगाई'))).toBe(true);
  });

  test('English: peshgi resolves to the name, head is translated, no UUID', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Ansari Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/roker`);

    await expect(page.getByTestId('roker-closing')).toBeVisible();

    const labels = await entryLabels(page);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l, `label "${l}" must not contain a UUID`).not.toMatch(UUID_RE);
    expect(labels.join('\n')).not.toMatch(/\bdyer\b/);

    // Peshgi row → "Peshgi · Salim".
    expect(labels.some((l) => l.includes('Peshgi') && l.includes('Salim'))).toBe(true);
    // Dyer manual entry → "Dyeing: …".
    expect(labels.some((l) => l.includes('Dyeing'))).toBe(true);
  });
});
