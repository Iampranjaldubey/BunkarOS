import { test, expect } from '@playwright/test';
import { setupAndLogin, attRow, markRadio } from './fixtures';

/**
 * Regression (2026-11-06): after P marks a row, focus moved to the next row one frame later. If ↑ was pressed before
 * that, the late move pulled focus back down and the next key marked the wrong worker. Here every IndexedDB write is
 * made slow, so the race happens every time.
 */
test('desktop: a slow save does not steal focus back after ↑', async ({ page }) => {
  await setupAndLogin(page);
  for (const name of ['Aamir', 'Bilal']) {
    await page.goto('/workers/new');
    await page.getByLabel(/^नाम/).fill(name); await page.getByLabel(/महीने की तनख्वाह/).fill('9000');
    await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  }
  await page.goto('/attendance');
  await expect(page.getByTestId('attendance-table')).toBeVisible();
  // Slow down every IndexedDB transaction completion by 400 ms.
  await page.evaluate(() => {
    const proto = IDBTransaction.prototype as unknown as { addEventListener: typeof EventTarget.prototype.addEventListener };
    const orig = proto.addEventListener;
    proto.addEventListener = function (this: IDBTransaction, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) {
      if (type === 'complete' && typeof fn === 'function') return orig.call(this, type, (ev: Event) => setTimeout(() => fn.call(this, ev), 400), opts);
      return orig.call(this, type, fn, opts);
    } as typeof proto.addEventListener;
  });
  const aamir = attRow(page, 'Aamir'); const bilal = attRow(page, 'Bilal');
  await bilal.focus();                        // the 2nd row: marking it would move focus back to itself (last row)
  await page.keyboard.press('p');            // save in flight…
  await page.keyboard.press('ArrowUp');      // …the user moves up to Aamir before it finishes
  await expect(aamir).toBeFocused();
  await expect(markRadio(bilal, 'P')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
  await page.waitForTimeout(600);            // the late focus move would happen here
  await expect(aamir).toBeFocused();         // still where the user went
  await page.keyboard.press('a');            // so this key marks Aamir, not Bilal
  await expect(markRadio(aamir, 'A')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
  await expect(markRadio(bilal, 'P')).toHaveAttribute('aria-checked', 'true');
});
