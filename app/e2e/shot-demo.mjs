// Bunkar OS — demo screenshot harness (owned by the demo + E2E agent).
// Self-contained: creates a unit, logs in as owner, seeds the demo via the
// demo module (dynamic import — no dependency on Settings wiring), then
// screenshots key screens and prints a JSON report with any page errors.
//
// Usage:
//   node e2e/shot-demo.mjs <baseUrl> <outDir>
//   e.g. node e2e/shot-demo.mjs http://localhost:5199 /tmp
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const base = process.argv[2] || 'http://localhost:5173';
const outDir = process.argv[3] || '/tmp';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

async function shot(name) {
  await page.waitForTimeout(600);
  const out = resolve(outDir, `demo-${name}.png`);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: out }); // viewport-only tile (<2000px) for image-safe review
  return out;
}

// --- setup + owner login (mirrors scripts/shot.mjs) ---
await page.goto(base + '/setup');
const inputs = page.locator('form input');
await inputs.first().waitFor();
const vals = ['Ansari Carpets', 'Salim Ansari', '9876543210', '1234', '1234'];
for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
await page.locator('form button[type=submit]').click();
await page.waitForURL(/login/);
await page.getByRole('button', { name: /Salim Ansari/ }).first().click();
for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'));

// --- seed demo via the demo module (window hook or dynamic import) ---
await page.evaluate(async () => {
  const w = window;
  if (w.__bunkarDemo) {
    await w.__bunkarDemo.load();
    return;
  }
  const mod = await import('/src/features/demo/index.ts');
  await mod.loadDemoData();
});
await page.waitForTimeout(500);

const shots = {};
const routes = [
  ['home', '/'],
  ['looms', '/looms'],
  ['weavers', '/weavers'],
  ['orders', '/orders'],
  ['roker', '/roker'],
  ['settings', '/settings'],
];
for (const [name, path] of routes) {
  await page.goto(base + path);
  shots[name] = await shot(name);
}

// Board counts straight from the projection, to verify 17/3/3/1.
const board = await page.evaluate(async () => {
  const mod = await import('/src/domain/projections.ts');
  const dbMod = await import('/src/db/db.ts');
  const sess = JSON.parse(localStorage.getItem('bunkar.session') || sessionStorage.getItem('bunkar.session') || 'null');
  const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
  const rows = mod.loomBoard(recs, new Date().toISOString());
  const by = { on_track: 0, slow: 0, idle: 0, free: 0 };
  for (const r of rows) by[r.status]++;
  return { total: rows.length, by };
});

console.log(JSON.stringify({ shots, board, errors }, null, 2));
await browser.close();
