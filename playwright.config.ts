import { defineConfig } from '@playwright/test'

const API = 'http://localhost:8000'
const UI = 'http://localhost:3000'
const apiDir = process.env.OPENPAWS_API_DIR ?? '../openpaws-api'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: UI,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  },
  projects: [
    // Registers (and verifies) the shared e2e user once: registration is rate limited per IP.
    { name: 'signup', testMatch: 'signup-upload.spec.ts' },
    { name: 'flows', testMatch: ['adult-gating.spec.ts', 'layout.spec.ts'], dependencies: ['signup'] },
  ],
  // Playwright stops all of these when the run ends.
  webServer: [
    {
      command: 'php artisan serve --port=8000',
      cwd: apiDir,
      url: `${API}/up`,
      reuseExistingServer: !!process.env.E2E_REUSE,
      timeout: 60_000,
    },
    {
      // Scout indexing runs on the queue, so search results need the worker.
      command: 'php -d memory_limit=512M artisan queue:work redis --queue=moves,media,video,default',
      cwd: apiDir,
      reuseExistingServer: !!process.env.E2E_REUSE,
      timeout: 60_000,
    },
    {
      command: 'npm run build && node .output/server/index.mjs',
      url: UI,
      reuseExistingServer: !!process.env.E2E_REUSE,
      timeout: 600_000,
      env: {
        NUXT_PUBLIC_API_BASE: API,
        NUXT_PUBLIC_SITE_URL: UI,
        PORT: '3000',
        HOST: 'localhost',
      },
    },
  ],
})
