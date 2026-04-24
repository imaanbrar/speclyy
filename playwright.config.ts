import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

/**
 * Optional project matrix. Chromium is the only always-on project; WebKit and
 * Firefox are opt-in via `E2E_BROWSERS=all` so contributors can iterate on a
 * single browser locally without paying the 3x cost.
 */
const allBrowsers = process.env.E2E_BROWSERS === 'all'

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  workers: isCI ? 1 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: isCI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(allBrowsers
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
  webServer: {
    command: isCI
      ? 'pnpm --filter @speclyy/web build && pnpm --filter @speclyy/web start'
      : 'pnpm --filter @speclyy/web dev',
    url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
