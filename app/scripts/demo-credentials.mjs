// Bunkar OS — create a ready-to-explore DEMO unit with known credentials on a running instance.
//
// Usage (from app/):
//   node scripts/demo-credentials.mjs [baseUrl] [--photos=<dir>] [--out=<file.json>]
//     baseUrl  default http://localhost:4180 (built app whose /api reaches the server)
//     --photos write sample "photos" (JPEG) to <dir> for flows that need one
//     --out    also write the credentials JSON to <file.json> (keep it OUT of the repo)
//
// What it does (only through the public UI + the app's own IndexedDB, so it works
// against a production build):
//   1. creates unit "Ansari Carpets" with owner Anwar Ansari (PIN 1111)
//   2. loads the demo data (24 looms, orders EX-118/121/125, weavers, rates, roker…)
//   3. adds munshi Ramesh Yadav (PIN 2222) and thekedar Shamim (PIN 3333, bound to
//      thekedar Shamim's looms), checks both can log in, then signs their phones out
//      again so YOUR browser can be their phone (one phone per login, SPEC-014)
//   4. syncs everything to the server and checks a second fresh browser can JOIN with
//      the unit code + key and log in
// Every run creates a NEW unit (new code/key). Demo PINs are deliberately simple —
// never reuse them for real data.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:4180').replace(/\/$/, '');
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const PHOTOS_DIR = opt('photos');
const OUT = opt('out');

const UNIT_NAME = 'Ansari Carpets';
const OWNER = { name: 'Anwar Ansari', phone: '9876543210', pin: '1111', role: 'owner' };
const MUNSHI = { name: 'Ramesh Yadav', phone: '9876500011', pin: '2222', role: 'munshi' };
const THEKEDAR = { name: 'Shamim', phone: '9876500022', pin: '3333', role: 'thekedar', entity: /Shamim/i };

const log = (...m) => console.error('[demo]', ...m);

// ---------- page helpers (raw IndexedDB: works on a production build) ----------
function idbRead(page, store) {
  return page.evaluate((store) => new Promise((resolve, reject) => {
    const open = indexedDB.open('bunkar');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onerror = () => { db.close(); reject(req.error); };
      req.onsuccess = () => {
        db.close();
        // Photos hold Blobs (not serialisable) — return bookkeeping fields only.
        resolve(store === 'photos' ? req.result.map((r) => ({ id: r.id, sync: r.sync })) : req.result);
      };
    };
  }), store);
}
async function meta(page, key) {
  const rows = await idbRead(page, 'meta');
  return rows.find((r) => r.key === key)?.value;
}
async function unitRecords(page) {
  const unit = await meta(page, 'bunkar.unit');
  const recs = await idbRead(page, 'records');
  return recs.filter((r) => r.unitId === unit?.unitId);
}
async function waitFor(fn, { timeout = 60_000, every = 500, what = 'condition' } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

async function clearSession(page) {
  await page.evaluate(() => { localStorage.removeItem('bunkar.session'); sessionStorage.removeItem('bunkar.session'); });
}
async function login(page, user) {
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: new RegExp(user.name) }).first().click({ timeout: 30_000 });
  for (const d of user.pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}
async function english(page) {
  // The header (with the हिंदी/EN switch) renders a moment after login — wait for it.
  const en = page.getByRole('radio', { name: 'EN' }).first();
  await en.waitFor({ timeout: 30_000 });
  await en.click();
  await page.waitForFunction(() => localStorage.getItem('bunkar.lang') === 'en', undefined, { timeout: 30_000 });
}
async function syncUntilClean(page, what) {
  await page.goto(`${BASE}/settings`);
  await waitFor(async () => {
    const btn = page.getByRole('button', { name: 'Sync now' }).first();
    if (await btn.count()) await btn.click().catch(() => {});
    const recs = await unitRecords(page);
    const photos = await idbRead(page, 'photos');
    const pending = recs.filter((r) => r.sync === 'pending').length + photos.filter((p) => p.sync === 'pending').length;
    const rejected = recs.filter((r) => r.sync === 'rejected');
    if (rejected.length) throw new Error(`server rejected ${rejected.length} records: ${rejected.map((r) => `${r.type}:${r.rejectReason}`).join(', ')}`);
    const rejectedPhotos = photos.filter((p) => p.sync === 'rejected');
    if (rejectedPhotos.length) throw new Error(`server rejected ${rejectedPhotos.length} photos`);
    return pending === 0;
  }, { timeout: 120_000, every: 3000, what });
}
async function addUser(page, u) {
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Add a user' }).click();
  // Labels carry a required "*", so match by prefix; only the open sheet's fields are visible.
  const field = (re) => page.getByLabel(re).filter({ visible: true }).first();
  await field(/^Name/).fill(u.name);
  await field(/^Phone/).fill(u.phone);
  if (u.role === 'thekedar') {
    await page.getByRole('radio', { name: 'Thekedar' }).filter({ visible: true }).first().click();
    const select = page.getByTestId('user-thekedar-select');
    const labels = await select.locator('option').allTextContents();
    const label = labels.find((l) => u.entity.test(l));
    if (!label) throw new Error(`thekedar entity not found among: ${labels.join(', ')}`);
    await select.selectOption({ label });
  }
  await field(/^4-digit PIN/).fill(u.pin);
  await field(/^Re-enter PIN/).fill(u.pin);
  await page.getByRole('button', { name: 'Save user' }).click();
  // Saving hashes the PIN (PBKDF2) before writing — wait until the sheet closes and the
  // user appears in the list with the right role, so we never navigate away mid-save.
  await page.getByRole('button', { name: 'Save user' }).waitFor({ state: 'hidden', timeout: 30_000 });
  const roleLabel = { munshi: 'Munshi', thekedar: 'Thekedar' }[u.role];
  await page.locator('li').filter({ hasText: u.name }).filter({ hasText: roleLabel }).first().waitFor({ timeout: 30_000 });
  const saved = await waitFor(async () => (await unitRecords(page)).some((r) => r.type === 'user' && r.payload.name === u.name && r.payload.role === u.role), { what: `user ${u.name} stored` });
  if (!saved) throw new Error(`user ${u.name} was not stored`);
}
async function signOutPhone(page, u) {
  await page.goto(`${BASE}/settings`);
  const card = page.locator('li').filter({ hasText: u.name }).filter({ has: page.getByRole('button', { name: 'Sign out this phone' }) }).first();
  await card.waitFor({ timeout: 30_000 });
  await card.getByRole('button', { name: 'Sign out this phone' }).click();
  await page.getByRole('button', { name: 'Sign out this phone' }).last().click();
  await page.getByText('Signed out of the phone').first().waitFor({ timeout: 30_000 });
}

// ---------- sample photos (simple drawings standing in for real camera shots) ----------
async function writeSamplePhotos(page, dir) {
  mkdirSync(dir, { recursive: true });
  const shots = await page.evaluate(() => {
    const out = {};
    const make = (name, draw) => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 960;
      const g = c.getContext('2d'); draw(g, c.width, c.height); out[name] = c.toDataURL('image/jpeg', 0.82);
    };
    const label = (g, text, x, y, size = 64, color = '#1A2030') => { g.fillStyle = color; g.font = `700 ${size}px sans-serif`; g.fillText(text, x, y); };
    const rug = (g, x, y, w, h) => {
      g.fillStyle = '#9E2B25'; g.fillRect(x, y, w, h);
      g.fillStyle = '#EFE6D2'; g.fillRect(x + 24, y + 24, w - 48, h - 48);
      g.fillStyle = '#23395B'; g.fillRect(x + 48, y + 48, w - 96, h - 96);
      g.fillStyle = '#C98A1C';
      g.beginPath(); g.moveTo(x + w / 2, y + 90); g.lineTo(x + w - 120, y + h / 2); g.lineTo(x + w / 2, y + h - 90); g.lineTo(x + 120, y + h / 2); g.fill();
    };
    make('tape-measure', (g, w, h) => {
      g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, w, h); rug(g, 80, 160, w - 160, h - 320);
      g.fillStyle = '#F2C230'; g.fillRect(60, h - 230, w - 120, 90);
      g.fillStyle = '#1A2030'; for (let i = 0; i < 48; i++) { const xx = 70 + i * 24; g.fillRect(xx, h - 230, 3, i % 4 === 0 ? 50 : 26); }
      label(g, "9' 11\"  (1 inch short)", 90, 110, 72);
    });
    make('scale-21.600kg', (g, w, h) => {
      g.fillStyle = '#e8ebf0'; g.fillRect(0, 0, w, h); g.fillStyle = '#5A6275'; g.fillRect(240, 520, 800, 300);
      g.fillStyle = '#0E1118'; g.fillRect(360, 580, 560, 170); label(g, '21.600 kg', 420, 700, 110, '#4CFF7A');
      rug(g, 300, 220, 680, 300); label(g, 'Carpet on the scale', 330, 140, 64);
    });
    make('carpet', (g, w, h) => { g.fillStyle = '#cfc6b4'; g.fillRect(0, 0, w, h); rug(g, 140, 100, w - 280, h - 200); });
    make('loom-checkin', (g, w, h) => {
      g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b4a2b'; g.fillRect(120, 80, 40, h - 160); g.fillRect(w - 160, 80, 40, h - 160);
      g.fillRect(120, 80, w - 240, 36); g.strokeStyle = '#b9ae96'; g.lineWidth = 2;
      for (let x = 180; x < w - 180; x += 10) { g.beginPath(); g.moveTo(x, 116); g.lineTo(x, 560); g.stroke(); }
      rug(g, 170, 560, w - 340, 300); label(g, 'Loom 07 — progress', 380, 60, 56);
    });
    make('weaver', (g, w, h) => {
      g.fillStyle = '#26406B'; g.fillRect(0, 0, w, h); g.fillStyle = '#C98A1C';
      g.beginPath(); g.arc(w / 2, 380, 170, 0, Math.PI * 2); g.fill(); g.fillRect(w / 2 - 300, 600, 600, 360);
      label(g, 'Weaver photo', w / 2 - 230, 140, 80, '#ffffff');
    });
    make('payment-receipt', (g, w, h) => {
      g.fillStyle = '#e9ecf2'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(320, 80, 640, 800);
      label(g, 'UPI receipt', 420, 200, 64); label(g, '₹ 2,500', 430, 400, 110, '#2F7D4A'); label(g, 'Paid', 560, 520, 64, '#5A6275');
    });
    return out;
  });
  const files = [];
  for (const [name, dataUrl] of Object.entries(shots)) {
    const file = join(dir, `${name}.jpg`);
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    files.push(file);
  }
  return files;
}

// ---------------------------------- main ----------------------------------
const browser = await chromium.launch();
const errors = [];
try {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ctxA.newPage();
  a.on('pageerror', (e) => errors.push(String(e)));

  log('1/7 creating the unit');
  await a.goto(`${BASE}/setup`);
  const inputs = a.locator('form input');
  await inputs.first().waitFor({ timeout: 30_000 });
  const vals = [UNIT_NAME, OWNER.name, OWNER.phone, OWNER.pin, OWNER.pin];
  for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
  await a.locator('form button[type=submit]').click();
  await a.waitForURL(/\/login/, { timeout: 30_000 });
  await login(a, OWNER);
  await english(a);

  log('2/7 loading demo data');
  await a.goto(`${BASE}/settings`);
  await a.getByTestId('load-demo').click();
  await waitFor(async () => Boolean(await meta(a, 'bunkar.demo.seeded')), { timeout: 90_000, what: 'demo seed' });

  log('3/7 adding munshi + thekedar');
  await addUser(a, MUNSHI);
  await addUser(a, THEKEDAR);

  log('4/7 syncing to the server');
  await syncUntilClean(a, 'first sync');

  log('5/7 checking munshi + thekedar logins, then freeing their phones');
  await clearSession(a); await login(a, MUNSHI);
  await a.getByText('What do you want to do?').first().waitFor({ timeout: 30_000 });
  await clearSession(a); await login(a, THEKEDAR);
  await a.getByText('My looms').first().waitFor({ timeout: 30_000 });
  await clearSession(a); await login(a, OWNER);
  await signOutPhone(a, MUNSHI);
  await signOutPhone(a, THEKEDAR);

  const unit = await meta(a, 'bunkar.unit');
  const recs = await unitRecords(a);
  const latest = new Map();
  for (const r of recs.filter((x) => x.type === 'user')) {
    const prev = latest.get(r.payload.entityId);
    if (!prev || prev.at < r.at) latest.set(r.payload.entityId, r);
  }
  const users = [...latest.values()].map((r) => ({ name: r.payload.name, role: r.payload.role, active: r.payload.active }));
  const bazaarById = new Map(recs.filter((r) => r.type === 'bazaar').map((r) => [r.id, r.payload]));
  const slips = recs.filter((r) => r.type === 'slip').map((r) => ({
    weaver: r.payload.weaverName,
    kind: r.payload.kind,
    piece: bazaarById.get(r.payload.sourceId)?.pieceId ?? null,
    paidPaise: bazaarById.get(r.payload.sourceId)?.paidPaise ?? null,
    url: `${BASE}/s/${r.payload.token}`,
    token: r.payload.token,
  }));
  const orders = recs.filter((r) => r.type === 'order').map((r) => r.payload.orderNo);

  log('6/7 checking public slip links + voice clips on the server');
  for (const s of slips) {
    const view = await fetch(`${BASE}/api/slips/${s.token}`);
    const audio = await fetch(`${BASE}/api/slips/${s.token}/audio`);
    s.viewStatus = view.status;
    s.audio = audio.status === 200 ? `${audio.headers.get('content-type')}, ${(await audio.arrayBuffer()).byteLength} bytes` : `HTTP ${audio.status}`;
  }

  log('7/7 joining from a second, fresh browser (like yours will)');
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await ctxB.newPage();
  b.on('pageerror', (e) => errors.push(String(e)));
  await b.goto(`${BASE}/`);
  await b.waitForURL(/\/setup/, { timeout: 30_000 });
  await b.getByRole('radio', { name: 'मौजूदा यूनिट से जुड़ें' }).click();
  await b.getByLabel('यूनिट कोड').fill(unit.unitId);
  await b.getByLabel('यूनिट चाबी').fill(unit.unitKey);
  await b.getByRole('button', { name: 'जुड़ें', exact: true }).click();
  await b.waitForURL(/\/login/, { timeout: 30_000 });
  for (const u of [OWNER, MUNSHI, THEKEDAR]) {
    await b.getByRole('button', { name: new RegExp(u.name) }).first().waitFor({ timeout: 30_000 });
  }
  await login(b, OWNER);
  const serverCount = recs.length;
  await waitFor(async () => (await unitRecords(b)).length >= serverCount, { timeout: 120_000, every: 2000, what: 'second browser to pull all data' });
  await b.goto(`${BASE}/`);
  await b.getByTestId('loom-tile').first().waitFor({ timeout: 30_000 });
  const loomTiles = await b.getByTestId('loom-tile').count();
  const legend = (await b.getByTestId('board-legend').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  await ctxB.close();

  const photos = PHOTOS_DIR ? await writeSamplePhotos(a, PHOTOS_DIR) : [];
  await ctxA.close();

  const result = {
    createdAt: new Date().toISOString(),
    app: BASE,
    unit: { name: UNIT_NAME, code: unit.unitId, key: unit.unitKey },
    logins: [OWNER, MUNSHI, THEKEDAR].map(({ name, pin, role, phone }) => ({ name, role, pin, phone })),
    usersOnServer: users,
    records: recs.length,
    orders,
    slips: slips.map(({ token, ...s }) => s),
    secondBrowser: { joined: true, loomTiles, legend },
    photos,
    pageErrors: errors,
  };
  if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
