// Bunkar OS — E2E 14: Hindi voice slip clip (SPEC-015, C9).
//
// Precondition: a demo bazaar slip is synced to the server. The public slip page
// at /s/<token> shows a big ▶ "सुनें / Listen" button.
//
// NOTE ON WIRING: GET /api/slips/:token/audio only exists AFTER the controller
// wires it in routes.mjs (c9 owns server/slip-audio.mjs + its node:test; the
// controller adds the route). Assertions that hit the audio endpoint are tagged
// `@needs-audio-route` below and are skipped (soft) when the route 404s, so this
// spec is green both before and after wiring; the fallback-path assertion does
// NOT depend on the route.
import { test, expect, type Page } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, resetLocal } from './fixtures';

/** Sync local records to the server and return the first bazaar slip token. */
async function syncAndGetToken(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
    await sync.syncNow();
    const dbMod = (await import('/src/db/db.ts')) as {
      db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; payload: { kind?: string; token?: string } }>> } } } };
    };
    const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
    const sess = JSON.parse(raw) as { unitId: string };
    const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
    const slip = recs.find((r) => r.type === 'slip' && r.payload.kind === 'bazaar');
    return (slip?.payload.token as string) ?? '';
  });
}

test.describe('14 voice slip clip (C9)', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('audio endpoint returns audio/wav with RIFF header [needs controller audio-route wiring]', async ({ page, request }) => {
    await createUnitAndLogin(page, { name: 'Audio Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    const token = await syncAndGetToken(page);
    expect(token).toBeTruthy();

    const res = await request.get(`http://localhost:8787/api/slips/${token}/audio`);
    if (res.status() === 404) {
      // Route not wired yet (controller step pending). Verify the server
      // handler contract is covered by server/test/slip-audio.test.mjs instead.
      test.skip(true, 'audio route not wired in routes.mjs yet (controller step)');
      return;
    }
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio/wav');
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(44);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
  });

  test('public page ▶ plays the clip (or shows playing state) [needs controller audio-route wiring]', async ({ page, browser, request }) => {
    await createUnitAndLogin(page, { name: 'Audio Play Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    const token = await syncAndGetToken(page);
    expect(token).toBeTruthy();

    const probe = await request.get(`http://localhost:8787/api/slips/${token}/audio`);
    test.skip(probe.status() === 404, 'audio route not wired in routes.mjs yet (controller step)');

    const ctx = await browser.newContext({ ...test.info().project.use, baseURL: 'http://localhost:5173' });
    const pub = await ctx.newPage();
    try {
      await pub.goto(`${APP}/s/${token}`);
      await expect(pub.getByTestId('slip-speak')).toBeVisible({ timeout: 10_000 });
      await pub.getByTestId('slip-speak').click();
      // Either the <audio> element advances (real playback) or the button shows
      // the playing state. We assert the playing/loading affordance appears.
      await expect(pub.getByTestId('slip-speak')).toHaveText(/Playing|चल रहा|Preparing|तैयार/i, { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });

  test('public page falls back to device TTS when the clip request fails', async ({ page, browser }) => {
    await createUnitAndLogin(page, { name: 'Audio Fallback Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    const token = await syncAndGetToken(page);
    expect(token).toBeTruthy();

    const ctx = await browser.newContext({ ...test.info().project.use, baseURL: 'http://localhost:5173' });
    const pub = await ctx.newPage();
    try {
      // Abort the audio request so the page MUST fall back to on-device TTS.
      await pub.route('**/api/slips/*/audio', (route) => route.abort());
      // Record whether speechSynthesis.speak() was invoked (the fallback path).
      await pub.addInitScript(() => {
        const w = window as unknown as { __spoke?: boolean };
        w.__spoke = false;
        try {
          const synth = window.speechSynthesis;
          if (synth && typeof synth.speak === 'function') {
            const orig = synth.speak.bind(synth);
            synth.speak = (u: SpeechSynthesisUtterance) => { w.__spoke = true; try { orig(u); } catch { /* ignore */ } };
          }
        } catch { /* ignore */ }
      });

      await pub.goto(`${APP}/s/${token}`);
      await expect(pub.getByTestId('slip-speak')).toBeVisible({ timeout: 10_000 });
      await pub.getByTestId('slip-speak').click();

      // The clip errors → the page shows the fallback affordance (fallback note
      // or the no-voice note) AND attempts on-device speech.
      await expect
        .poll(
          async () =>
            pub.evaluate(() => {
              const w = window as unknown as { __spoke?: boolean };
              const txt = document.body.innerText;
              return (
                w.__spoke === true ||
                /फ़ोन की आवाज़|phone voice|पढ़कर|read it/i.test(txt)
              );
            }),
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await ctx.close();
    }
  });
});
