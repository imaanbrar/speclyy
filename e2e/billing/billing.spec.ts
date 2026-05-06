/**
 * E2E coverage for the billing + onboarding flow.
 *
 * Each `test(...)` corresponds to a row in
 * `docs/implementation-tasks/billing-subscription/TEST-PLAN-billing-onboarding-flow.md`
 * (the Section/ID is in the title). Tests assume the global setup hook
 * has booted `stripe listen`, written the webhook secret into
 * `.env.local`, provisioned the test user, and produced a Playwright
 * storage state at `e2e/.tmp/storage-state.json`.
 *
 * Tests run **serially** (not in parallel) because they all share one
 * Supabase user — running in parallel would race on `subscriptions` rows
 * and the `onboarding_completed_at` stamp. Each test resets the user to
 * a known starting state via the service-role admin client.
 */

import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { APPS_WEB, TEST_USER_FILE } from './_setup'

// All tests share one storage state and need to mutate user state, so
// running concurrently would make assertions racy.
test.describe.configure({ mode: 'serial' })

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(resolve(APPS_WEB, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function getTestUser(): { userId: string; email: string; password: string } {
  return JSON.parse(readFileSync(TEST_USER_FILE, 'utf8'))
}

function admin(): SupabaseClient {
  const env = getEnv()
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Mirror of `apps/web/scripts/test-user/reset.mjs` — kept inline so the
 *  spec is self-contained (no shell-out). */
async function resetUser(mode: 'fresh' | 'onboarded-free' | 'onboarded-pro-active' = 'fresh') {
  const { userId } = getTestUser()
  const sb = admin()

  await sb.from('subscriptions').delete().eq('user_id', userId)

  await sb
    .from('profiles')
    .update({
      first_name: null,
      last_name: null,
      market: null,
      has_visited_dashboard: false,
      onboarding_completed_at: mode === 'fresh' ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (mode === 'onboarded-pro-active') {
    const periodEnd = new Date()
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    await sb.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      stripe_customer_id: `cus_e2e_${userId.replace(/-/g, '').slice(0, 14)}`,
      stripe_subscription_id: `sub_e2e_${userId.replace(/-/g, '').slice(0, 14)}`,
      current_period_end: periodEnd.toISOString(),
      entitlements: { speclyy: { plan: 'pro' } },
    })
  }
}

/** Wait for the webhook to flip the row to `active` (max 20 s). */
async function waitForActiveSub(timeoutMs = 20_000): Promise<void> {
  const { userId } = getTestUser()
  const sb = admin()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await sb
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.status === 'active') return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for subscriptions.status='active' (${timeoutMs}ms)`)
}

/**
 * Stripe Elements renders inside an iframe. The card-number / expiry / CVC
 * fields are split across one or more iframes depending on Stripe's
 * current `<PaymentElement>` layout. Find them by their internal title /
 * placeholder.
 */
async function fillCard(page: Page, opts: { number: string; expiry?: string; cvc?: string; zip?: string }) {
  const expiry = opts.expiry ?? '12 / 34'
  const cvc = opts.cvc ?? '123'
  const zip = opts.zip ?? '94103'

  // The Elements iframe carries a title like "Secure payment input frame".
  const cardFrame = page.frameLocator('iframe[title*="payment input"], iframe[name^="__privateStripeFrame"]').first()

  // Use role=textbox throughout — `getByLabel` matches the field's SVG icon
  // for CVC (label "Credit or debit card CVC") which fails strict-mode.
  await cardFrame.getByRole('textbox', { name: /card number/i }).fill(opts.number)
  await cardFrame.getByRole('textbox', { name: /expiration/i }).fill(expiry)
  await cardFrame.getByRole('textbox', { name: /security code|cvc/i }).fill(cvc)
  const zipField = cardFrame.getByRole('textbox', { name: /zip|postal/i })
  if (await zipField.count()) await zipField.fill(zip)
}

// ------------------------------------------------------------------
// Section C — Profile self-heal
// ------------------------------------------------------------------

/**
 * Locate the primary action button on an onboarding step. The footer has
 * a "Sign out" submit button (different form), and dev mode adds a Next.js
 * floating button — both confound a loose role+name match. Filter by the
 * exact label of the step's CTA.
 */
function ctaButton(page: Page, label: string) {
  return page.getByRole('button', { name: label, exact: true })
}

test('C1 — name form upserts profiles row', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/name')
  await expect(page).toHaveURL(/\/onboarding\/name/)

  await page.getByLabel(/first name/i).fill('Test')
  await page.getByLabel(/last name/i).fill('User')
  await ctaButton(page, "Continue").click()

  await expect(page).toHaveURL(/\/onboarding\/studio/, { timeout: 10_000 })

  // Verify the upsert via service-role.
  const { userId } = getTestUser()
  const { data } = await admin()
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single()
  expect(data).toMatchObject({ first_name: 'Test', last_name: 'User' })
})

test('C2 — trigger-missed self-heal (delete profile, re-submit name)', async ({ page }) => {
  await resetUser('fresh')
  const { userId } = getTestUser()

  // Simulate the trigger never firing by deleting the profiles row.
  await admin().from('profiles').delete().eq('id', userId)

  await page.goto('/onboarding/name')
  await page.getByLabel(/first name/i).fill('Heal')
  await page.getByLabel(/last name/i).fill('Path')
  await ctaButton(page, "Continue").click()

  await expect(page).toHaveURL(/\/onboarding\/studio/, { timeout: 10_000 })

  const { data } = await admin()
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single()
  expect(data).toMatchObject({ first_name: 'Heal', last_name: 'Path' })
})

// ------------------------------------------------------------------
// Section D — Plan step
// ------------------------------------------------------------------

test('D2 — Free path stamps onboarding and lands on /welcome', async ({ page }) => {
  await resetUser('fresh')

  // Walk through name + studio + market quickly so the user reaches /plan.
  // (Or jump straight to /plan — middleware lets them.)
  await page.goto('/onboarding/plan')
  await expect(page.getByText(/Continue with Free/i)).toBeVisible()

  // Free is preselected (J2 fix); the form's submit button reads
  // "Continue with Free".
  await ctaButton(page, "Continue with Free").click()
  await expect(page).toHaveURL(/\/welcome/, { timeout: 10_000 })

  const { userId } = getTestUser()
  const { data } = await admin()
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .single()
  expect(data?.onboarding_completed_at).not.toBeNull()
})

// ------------------------------------------------------------------
// Section F — Payment success paths
// ------------------------------------------------------------------

test('F1 — Annual success → receipt with $348 USD', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/checkout')
  await expect(page.getByText(/Recommended/i)).toBeVisible()

  // Wait for Stripe Elements to hydrate (button is `disabled={!stripe}`
  // until the SDK is ready). Without this, clicking too early silently
  // does nothing and the test hangs waiting for the redirect.
  const payButton = page.getByRole('button', { name: /pay \$348 USD/i })
  await expect(payButton).toBeEnabled({ timeout: 15_000 })

  await fillCard(page, { number: '4242 4242 4242 4242' })
  await payButton.click()

  // Stripe confirmPayment redirects to /billing/success on success.
  await page.waitForURL(/\/billing\/success/, { timeout: 30_000 })

  // Receipt swap-in is webhook-driven; poller refreshes once status flips.
  await waitForActiveSub()
  await expect(page.getByText(/Pro · Annual/i)).toBeVisible({ timeout: 20_000 })
})

test('F2 — Monthly success → receipt with $37 USD', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/checkout?interval=monthly')
  const payButton = page.getByRole('button', { name: /pay \$37 USD/i })
  await expect(payButton).toBeEnabled({ timeout: 15_000 })

  await fillCard(page, { number: '4242 4242 4242 4242' })
  await payButton.click()

  await page.waitForURL(/\/billing\/success/, { timeout: 30_000 })
  await waitForActiveSub()
  await expect(page.getByText(/Pro · Monthly/i)).toBeVisible({ timeout: 20_000 })
})

test('F4 — DB row after webhook has all six fields', async () => {
  // F1 left the user active; just inspect the row.
  const { userId } = getTestUser()
  const { data } = await admin().from('subscriptions').select('*').eq('user_id', userId).single()
  expect(data?.status).toBe('active')
  expect(data?.stripe_customer_id).toMatch(/^cus_/)
  expect(data?.stripe_subscription_id).toMatch(/^sub_/)
  expect(data?.current_period_end).not.toBeNull()
  expect(data?.entitlements).toMatchObject({ speclyy: { plan: 'pro' } })
})

// ------------------------------------------------------------------
// Section G — Payment failure paths
// ------------------------------------------------------------------

/**
 * The checkout-form's inline error renders in a `<p role="alert">`. Next.js
 * also exposes a global `<div role="alert" id="__next-route-announcer__">`
 * for screen readers, which is empty until a route change. Filter by text
 * presence — only the error has text content.
 */
function checkoutError(page: Page) {
  return page.locator('[role="alert"]').filter({ hasText: /\S/ })
}

test('G2 — Always-declined card surfaces inline error', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/checkout?interval=monthly')
  const payButton = page.getByRole('button', { name: /pay \$37 USD/i })
  await expect(payButton).toBeEnabled({ timeout: 15_000 })

  await fillCard(page, { number: '4000 0000 0000 0002' })
  await payButton.click()

  await expect(checkoutError(page)).toContainText(/declined/i, { timeout: 20_000 })
  // Button should be re-enabled, not stuck at "Processing…".
  await expect(payButton).toBeEnabled()
})

test('G3 — Insufficient funds surfaces inline error', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/checkout?interval=monthly')
  const payButton = page.getByRole('button', { name: /pay \$37 USD/i })
  await expect(payButton).toBeEnabled({ timeout: 15_000 })

  await fillCard(page, { number: '4000 0000 0000 9995' })
  await payButton.click()

  await expect(checkoutError(page)).toContainText(/insufficient/i, { timeout: 20_000 })
  await expect(payButton).toBeEnabled()
})

test('G7 — Network failure during startProCheckout is recoverable (post-fix)', async ({ page }) => {
  await resetUser('fresh')

  await page.goto('/onboarding/checkout?interval=monthly')

  // Wait for the Pay button to be enabled — confirms Stripe Elements has
  // mounted (button is `disabled={!stripe || submitting}` and only enables
  // once the SDK is ready). Without this gate, the route-mock click can
  // race iframe boot and the POST happens against an unhydrated form.
  const payButton = page.getByRole('button', { name: /pay \$37 USD/i })
  await expect(payButton).toBeEnabled({ timeout: 15_000 })

  await fillCard(page, { number: '4242 4242 4242 4242' })

  // Block the server-action call (POST to the page URL with the Next-Action
  // header). This simulates a network drop between elements.submit() and
  // the action — the case G7 was about.
  await page.route('**/onboarding/checkout**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })

  await payButton.click()

  // POST-fix expectation: inline "Network error" + button re-enabled.
  await expect(checkoutError(page)).toContainText(/network error/i, { timeout: 15_000 })
  await expect(payButton).toBeEnabled()
})

// ------------------------------------------------------------------
// Section H — Already-subscribed paths (live-confirm via test user)
// ------------------------------------------------------------------

test('H1 — direct hit on /onboarding/checkout when active redirects to /projects', async ({ page }) => {
  await resetUser('onboarded-pro-active')
  const response = await page.goto('/onboarding/checkout', { waitUntil: 'commit' })
  // Middleware (or page guard) redirects; final URL is /projects.
  await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })
  // Defensive — confirm we did go through a redirect chain.
  expect(response?.status()).toBeLessThan(500)
})
