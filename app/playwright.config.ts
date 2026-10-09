// Bunkar OS — Playwright E2E config (owned by the demo + E2E harness agent).
// Two server stacks:
//  • dev stack  — API :8787 + Vite dev :5173, used by the "mobile" project for
//    all specs except the offline one.
//  • preview stack — API :8788 + a *production preview* on :4173 (vite build →
//    vite preview) where the service worker is active, used by the "offline"
//    project so app-shell offline navigation + reload can be exercised for real.
// Mobile-emulated (390x844, touch) in both.
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Separate throwaway sqlite dbs per stack so they never collide.
const TEST_DB = resolve(__dirname, 'test-results', 'e2e.sqlite');
const PREVIEW_DB = resolve(__dirname, 'test-results', 'e2e-preview.sqlite');

const mobile = {
  ...devices['Pixel 7'],
  browserName: 'chromium' as const,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'mobile',
      testIgnore: /05b-offline-shell\.spec\.ts/,
      use: { ...mobile, baseURL: 'http://localhost:5173' },
    },
    {
      name: 'offline',
      testMatch: /05b-offline-shell\.spec\.ts/,
      use: { ...mobile, baseURL: 'http://localhost:4173' },
    },
  ],

  webServer: [
    {
      command: 'node ../server/index.mjs',
      url: 'http://localhost:8787/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: '8787', BUNKAR_DB: TEST_DB, AUTH_RATE_MAX: '100000' },
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    // Preview stack for the offline/service-worker spec.
    {
      command: 'node ../server/index.mjs',
      url: 'http://localhost:8788/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: '8788', BUNKAR_DB: PREVIEW_DB, AUTH_RATE_MAX: '100000' },
    },
    {
      // Build the PWA (service worker + bundled chunks), then serve the preview.
      // The preview proxies /api → :8788 (see vite.config preview proxy).
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
