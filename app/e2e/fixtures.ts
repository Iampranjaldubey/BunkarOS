// Bunkar OS — E2E helpers (owned by the demo + E2E harness agent).
// Thin, resilient wrappers around the real setup/login/demo flows so smoke
// tests read like a user's steps. All selectors mirror the actual DOM in
// SetupPage/LoginPage/DemoPanel; prefer role/testid over brittle text.
import { expect, type BrowserContext, type Page } from '@playwright/test';

// Empty base → all goto('/path') resolve against the project's baseURL
// (dev :5173 or preview :4173). Keeps specs portable across both stacks.
const APP = '';

/**
 * Create a brand-new unit + owner and land logged-in on the role home.
 * Mirrors scripts/shot.mjs: fill the 5 create-form inputs, submit, pick the
 * owner on /login, then tap the 4 PIN digits.
 */
export async function createUnitAndLogin(
  page: Page,
  opts: { name?: string; owner?: string; phone?: string; pin?: string } = {},
): Promise<void> {
  const unitName = opts.name ?? 'Ansari Carpets';
  const owner = opts.owner ?? 'Salim Ansari';
  const phone = opts.phone ?? '9876543210';
  const pin = opts.pin ?? '1234';

  await page.goto(`${APP}/setup`);
  const inputs = page.locator('form input');
  await inputs.first().waitFor();
  const values = [unitName, owner, phone, pin, pin];
  for (let i = 0; i < values.length; i++) {
    await inputs.nth(i).fill(values[i]);
  }
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(/\/login/);
  await loginAs(page, owner, pin);
}

/** From the /login screen, pick a user by name and enter their PIN. */
export async function loginAs(page: Page, userName: string, pin: string): Promise<void> {
  if (!page.url().includes('/login')) {
    await page.goto(`${APP}/login`);
  }
  await page.getByRole('button', { name: new RegExp(userName) }).first().click();
  await enterPin(page, pin);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Tap the on-screen numeric keypad for each PIN digit. */
export async function enterPin(page: Page, pin: string): Promise<void> {
  for (const d of pin) {
    await page.getByRole('button', { name: d, exact: true }).click();
  }
}

/**
 * Enter a wrong PIN for the currently picked user and return the visible error.
 * Assumes a user has already been picked on /login.
 */
export async function enterWrongPin(page: Page, pin: string): Promise<void> {
  await enterPin(page, pin);
}

/**
 * Seed the demo unit for the logged-in owner. Prefers the window hook installed
 * by src/features/demo/index.ts (present once anything imports the demo module,
 * e.g. the Settings panel). Falls back to a dynamic import of the demo module —
 * which Vite dev serves directly — so tests never depend on Settings wiring.
 */
export async function loadDemo(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as { __bunkarDemo?: { load: () => Promise<void> } };
    if (w.__bunkarDemo) {
      await w.__bunkarDemo.load();
      return;
    }
    const mod = (await import(
      /* @vite-ignore */ '/src/features/demo/index.ts'
    )) as { loadDemoData: () => Promise<void> };
    await mod.loadDemoData();
  });
}

/** Clear all local data for the active unit (hook or dynamic import). */
export async function clearDemo(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as { __bunkarDemo?: { clear: () => Promise<void> } };
    if (w.__bunkarDemo) {
      await w.__bunkarDemo.clear();
      return;
    }
    const mod = (await import(
      /* @vite-ignore */ '/src/features/demo/index.ts'
    )) as { clearUnitData: () => Promise<void> };
    await mod.clearUnitData();
  });
}

/** Simulate losing connectivity (service-worker/API fetches will fail). */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

/** Restore connectivity. */
export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
}

/** Convenience assertion: owner home shows the bottom nav + a home landmark. */
export async function expectHomeVisible(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/$|\/\?|\/#|localhost:5173\/$/);
  // Bottom nav is present on every role home.
  await expect(page.getByRole('navigation')).toBeVisible();
}

/**
 * Full local reset: wipe IndexedDB + storage so the next /setup starts clean.
 * Resilient to the demo window-hook being present or not. Call in afterEach.
 */
export async function resetLocal(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const w = window as unknown as { __bunkarDemo?: { clear: () => Promise<void> } };
      try {
        if (w.__bunkarDemo) await w.__bunkarDemo.clear();
      } catch {
        /* ignore */
      }
      localStorage.clear();
      sessionStorage.clear();
      await new Promise<void>((res) => {
        const req = indexedDB.deleteDatabase('bunkar');
        req.onsuccess = req.onerror = req.onblocked = () => res();
      });
    });
  } catch {
    /* page may be closed */
  }
}

/** Switch the app shell language to English (persisted) via the header toggle. */
export async function switchToEnglish(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^EN$|English/i }).first();
  if (await toggle.count()) await toggle.click();
}

/**
 * Force the app language to English by persisting the lang key, then reload so
 * the LangProvider picks it up. Deterministic for label-based form filling.
 */
export async function forceEnglish(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem('bunkar.lang', 'en'));
  await page.reload();
}

/** The active unitId from the stored session (localStorage or sessionStorage). */
export async function activeUnitId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
    return (JSON.parse(raw) as { unitId: string } | null)?.unitId ?? '';
  });
}

/** All records of the active unit, read straight from IndexedDB. */
export async function allRecords(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(async () => {
    const dbMod = (await import('/src/db/db.ts')) as { db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } } } };
    const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
    const sess = JSON.parse(raw) as { unitId: string } | null;
    if (!sess) return [];
    return (await dbMod.db.records.where('unitId').equals(sess.unitId).toArray()) as Array<Record<string, unknown>>;
  });
}

/** Run a named domain projection in-page and return its JSON result. */
export async function projection<T = unknown>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const proj = await import('/src/domain/projections.ts');
    const ids = await import('/src/domain/ids.ts');
    const dbMod = await import('/src/db/db.ts');
    const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
    const sess = JSON.parse(raw) as { unitId: string } | null;
    const recs = sess ? await dbMod.db.records.where('unitId').equals(sess.unitId).toArray() : [];
    const today = ids.istDay(new Date().toISOString());
    const nowISO = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('proj', 'recs', 'today', 'nowISO', 'ids', `return (${body});`);
    return run(proj, recs, today, nowISO, ids);
  }, fn);
}

/**
 * Append a Rec via the app's own addRecord, authored by the current session.
 * Used to seed preconditions E2E-only UI cannot create (e.g. a thekedar user
 * linked to a thekedar entity). Never touches src/db/types.ts.
 */
export async function addRecordInPage(page: Page, type: string, payload: unknown): Promise<string> {
  return page.evaluate(async ({ type, payload }) => {
    const repo = (await import('/src/db/repo.ts')) as { addRecord: (t: string, p: unknown) => Promise<{ id: string }> };
    const rec = await repo.addRecord(type, payload);
    return rec.id;
  }, { type, payload });
}

/** Hash a 4-digit PIN using the app's own pin util (for seeding login users). */
export async function hashPinInPage(page: Page, pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  return page.evaluate(async (pin) => {
    const mod = (await import('/src/lib/pin.ts')) as { hashPin: (p: string) => Promise<{ pinHash: string; pinSalt: string }> };
    return mod.hashPin(pin);
  }, pin);
}

/** A tiny valid 1x1 PNG as a Buffer, for page.setInputFiles / file uploads.
 *  Verified to decode via createImageBitmap in headless Chromium. */
export function pngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

/**
 * Upload a generated PNG into a PhotoCapture control and wait until it is
 * compressed + stored (the "Retake" button replaces "Take photo"). Pass the
 * file input locator; defaults to the first file input on the page.
 */
export async function uploadPhoto(page: Page, inputSelector = 'input[type=file]'): Promise<void> {
  await page.locator(inputSelector).first().setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: pngBuffer(),
  });
  // The control swaps to a Retake button once savePhoto resolves.
  await expect(page.getByRole('button', { name: /Retake|दोबारा लें/ }).first()).toBeVisible({ timeout: 15_000 });
}

export { APP };
