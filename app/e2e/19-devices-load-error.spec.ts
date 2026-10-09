// Bunkar OS — E2E 19: Settings → फ़ोन shows a correct, recoverable error when the
// device list fails to load (batch UI re-review blocker: it used to say "sign-out failed").
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, resetLocal } from './fixtures';

test.describe('19 settings phones load failure', () => {
  test('list-load failure shows the load error + retry, never "sign-out failed"; retry recovers', async ({ page }) => {
    test.setTimeout(90_000);
    await createUnitAndLogin(page, { name: 'Retry Carpets', owner: 'Malik Retry', pin: '1234' });

    // Make GET /api/devices fail (patchy data / server hiccup).
    let fail = true;
    await page.route('**/api/devices', async (route) => {
      if (fail && route.request().method() === 'GET') return route.fulfill({ status: 503, body: '{"error":"unavailable"}' });
      return route.continue();
    });

    await page.goto(`${APP}/settings`);
    const alert = page.getByRole('alert').filter({ hasText: 'फ़ोन की जानकारी नहीं आ पाई' });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('साइन आउट नहीं हो पाया')).toHaveCount(0);

    const retry = page.getByTestId('devices-retry');
    const box = await retry.boundingBox();
    expect(box && box.height >= 48).toBeTruthy();

    // Network recovers → retry loads the list (this phone is the owner's bound phone).
    fail = false;
    await retry.click();
    await expect(alert).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText('यही फ़ोन').first()).toBeVisible({ timeout: 15_000 });

    await resetLocal(page);
  });
});
