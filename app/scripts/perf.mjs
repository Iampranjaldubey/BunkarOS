// Bunkar OS — budget-Android performance probe (owned by core/perf fixer).
//
// Given a running preview URL it measures the PWA shell under a throttled
// profile that approximates a low-end Android on a slow mobile network:
//   • 4x CPU throttling (CDP Emulation.setCPUThrottlingRate)
//   • "Slow 4G" network: ~1.6 Mbps down / 0.75 Mbps up / 150 ms RTT
//     (CDP Network.emulateNetworkConditions)
//
// It loads /setup twice:
//   • COLD — a brand-new browser context (empty cache, no service worker), so
//     every byte crosses the throttled link.
//   • WARM — the SAME context reloaded after the service worker has installed
//     and precached the shell, so the shell is served from the SW cache.
//
// For each it reports { lcpMs, cls, transferKB, requests } using a
// PerformanceObserver (LCP + layout-shift) injected before navigation and the
// Resource Timing API (transferSize/encodedBodySize) for bytes.
//
// This script BUILDS NOTHING. Point it at a preview you started yourself, e.g.
//   npx vite build && npx vite preview --port 4175 --strictPort &
//   node scripts/perf.mjs http://localhost:4175
//
// Output: a single JSON line {cold:{...}, warm:{...}} on stdout.
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:4175';
const ROUTE = process.argv[3] || '/setup';
const URL = BASE.replace(/\/$/, '') + ROUTE;

// Slow 4G profile (bits→bytes): ~1.6 Mbps down, ~0.75 Mbps up, 150 ms RTT.
const SLOW_4G = {
  offline: false,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((0.75 * 1024 * 1024) / 8),
  latency: 150,
};
const CPU_THROTTLE = 4;

// Injected before any page script runs: start observing LCP + layout shifts
// immediately so we never miss early entries.
const OBSERVER_INIT = `
  window.__perf = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.lcp = Math.max(window.__perf.lcp, e.renderTime || e.loadTime || e.startTime || 0);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__perf.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) { /* older engines */ }
`;

/** Collect LCP (ms), CLS, transfer (KB), request count for the loaded page. */
async function collect(page) {
  // Give the LCP/CLS observers a beat to flush the final entries.
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    let bytes = nav ? nav.transferSize || nav.encodedBodySize || 0 : 0;
    let requests = nav ? 1 : 0;
    for (const r of res) {
      bytes += r.transferSize || r.encodedBodySize || 0;
      requests += 1;
    }
    const p = window.__perf || { lcp: 0, cls: 0 };
    return {
      lcpMs: Math.round(p.lcp),
      cls: Math.round(p.cls * 1000) / 1000,
      transferKB: Math.round(bytes / 1024),
      requests,
    };
  });
}

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return cdp;
}

const browser = await chromium.launch();
try {
  // --- COLD: fresh context, empty cache, no service worker yet. ---
  const coldCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    serviceWorkers: 'allow',
  });
  await coldCtx.addInitScript(OBSERVER_INIT);
  const page = await coldCtx.newPage();
  await throttle(page);
  await page.goto(URL, { waitUntil: 'load', timeout: 120_000 });
  const cold = await collect(page);

  // --- Let the service worker install + precache the shell. ---
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    // Give Workbox a moment to finish precaching after activation.
    await new Promise((r) => setTimeout(r, 1500));
    return Boolean(reg);
  });

  // --- WARM: reload the SAME context; the shell now comes from the SW cache. ---
  await page.addInitScript(OBSERVER_INIT);
  await page.reload({ waitUntil: 'load', timeout: 120_000 });
  const warm = await collect(page);

  await coldCtx.close();
  process.stdout.write(JSON.stringify({ cold, warm }) + '\n');
} finally {
  await browser.close();
}
