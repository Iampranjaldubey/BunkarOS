import { defineConfig } from '@playwright/test';

// Screenshot harness (not part of `npx playwright test`): API :8797 on schema `shots` + Vite :5176.
// Run: SHOTS_DIR=../docs/screenshots/m12/after npx playwright test -c scripts/shots.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: /shots\.spec\.ts$/,
  workers: 1,
  timeout: 240_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5176', actionTimeout: 15_000 },
  projects: [{ name: 'shots', use: { browserName: 'chromium' } }],
  webServer: [
    { command: 'node ../../server/index.mjs', cwd: '.', url: 'http://localhost:8797/api/health', reuseExistingServer: false, timeout: 30_000,
      env: { PORT: '8797', PGSCHEMA: 'shots', PG_RESET: '1', AUTH_RATE_MAX: '100000', SERVE_APP: '0' } },
    { command: 'npx vite --port 5176 --strictPort', cwd: '..', url: 'http://localhost:5176', reuseExistingServer: false, timeout: 60_000, env: { VITE_API_TARGET: 'http://localhost:8797' } },
  ],
});
