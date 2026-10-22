import { defineConfig, devices } from '@playwright/test';

// Dev stack: API :8795 on Postgres schema `e2e` (reset at boot via PG_RESET=1) + Vite :5174 proxying to it.
// (8791 is left free for the local demo server.)
const mobile = { ...devices['Pixel 7'], browserName: 'chromium' as const, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'on-first-retry', actionTimeout: 15_000, baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'mobile', testIgnore: /desktop/, use: mobile },
    { name: 'desktop', testMatch: /desktop/, use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  ],
  webServer: [
    { command: 'node ../server/index.mjs', url: 'http://localhost:8795/api/health', reuseExistingServer: false, timeout: 30_000,
      env: { PORT: '8795', PGSCHEMA: 'e2e', PG_RESET: '1', AUTH_RATE_MAX: '100000', CLAIM_RATE_MAX: '100000', WORKER_RATE_MAX: '100000', ADMIN_RATE_MAX: '100000', ADMIN_KEYS: 'shubham:e2e-admin-key-123,pranjal:e2e-admin-key-456', SERVE_APP: '0' } },
    { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 60_000, env: { VITE_API_TARGET: 'http://localhost:8795' } },
  ],
});
