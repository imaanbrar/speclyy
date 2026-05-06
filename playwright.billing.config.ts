/**
 * Dedicated Playwright config for the billing-flow E2E suite.
 *
 * Why a separate config (vs. the smoke harness in `playwright.config.ts`)?
 *
 *   - The billing suite needs `stripe listen` running and the freshly-printed
 *     `whsec_…` written into `.env.local` BEFORE the dev server boots.
 *     Playwright's built-in `webServer` starts before `globalSetup`, which
 *     would race the env write against `next dev` reading the env. So this
 *     config has no `webServer` — the global setup hook (`e2e/billing/_setup.ts`)
 *     boots the dev server itself, after writing the env.
 *
 *   - The suite shares one Supabase user and serializes around its
 *     `subscriptions` row, so it must run on a single worker, in serial,
 *     with no retries (a retry would clobber the row mid-flight).
 *
 *   - Storage state from the global setup is loaded for every test in this
 *     config so they start signed in as the e2e test user.
 *
 * Run from the repo root:
 *
 *     pnpm test:e2e:billing
 */

import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_DEV_PORT ?? 3000)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/billing',
  testMatch: /.*\.spec\.ts/,
  // One worker, no parallelism — single shared test user.
  fullyParallel: false,
  workers: 1,
  // 1 retry per test. Each spec does `resetUser('fresh')` at the start so
  // state is rebuilt from scratch on retry — safe. Mocked-network tests
  // (G7) are inherently timing-sensitive, and Stripe Elements iframes
  // occasionally race the action POST.
  retries: 1,
  // Stripe round-trips can take 10–15s end-to-end (Elements load, server
  // action, confirmPayment, webhook).
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-billing' }]],
  globalSetup: './e2e/billing/_setup.ts',
  globalTeardown: './e2e/billing/_teardown.ts',
  use: {
    baseURL: BASE_URL,
    storageState: './e2e/.tmp/storage-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
