// Screenshot helper for agents: creates a fresh unit + owner, logs in, opens a route, saves PNG.
// Usage: node scripts/shot.mjs <baseUrl> <path> <out.png> [--demo] [--lang=en]
//   e.g. node scripts/shot.mjs http://localhost:5174 /looms /tmp/looms.png --demo
// --demo clicks the "load demo data" control on /settings if present (data-testid="load-demo").
import { chromium } from '@playwright/test';

const [base, path = '/', out = '/tmp/shot.png', ...flags] = process.argv.slice(2);
const demo = flags.includes('--demo');
const lang = (flags.find((f) => f.startsWith('--lang=')) ?? '--lang=hi').split('=')[1];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

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
if (lang === 'en') {
  const toggle = page.getByRole('button', { name: /^EN$|English/i }).first();
  if (await toggle.count()) await toggle.click();
}
if (demo) {
  // Reliable seed: use the demo module directly (window hook installed by the
  // demo barrel, or a dynamic import fallback that Vite dev serves). Then wait
  // until the seed marker is written so projections are ready before shooting.
  // This avoids the old brittle "click + fixed 5s wait" against Settings.
  await page.evaluate(async () => {
    const w = window;
    if (w.__bunkarDemo) { await w.__bunkarDemo.load(); return; }
    const mod = await import('/src/features/demo/index.ts');
    await mod.loadDemoData();
  });
  await page.waitForFunction(async () => {
    const dbMod = await import('/src/db/db.ts');
    const marker = await dbMod.db.meta.get('bunkar.demo.seeded');
    return Boolean(marker && marker.value);
  }, undefined, { timeout: 20000 });
}
await page.goto(base + path);
await page.waitForTimeout(700);
// Image-safety: output is split into viewport tiles, each ≤ 1688 device px tall (< 2000 px limit
// for multi-image review). Tiles are written as <out>-1.png, <out>-2.png … (max 4) and <out> = tile 1.
const outs = [];
{
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = 844;
  const tiles = Math.min(4, Math.max(1, Math.ceil(total / vh)));
  for (let i = 0; i < tiles; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(150);
    const file = i === 0 ? out : out.replace(/\.png$/, `-${i + 1}.png`);
    await page.screenshot({ path: file });
    outs.push(file);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
console.log(JSON.stringify({ out, tiles: outs, url: page.url(), errors }));
await browser.close();
