#!/usr/bin/env node
// Reset the e2e test user's billing + onboarding state to a known starting
// point, without recreating the user. Use this between test runs so each
// section starts from the same baseline.
//
// Usage from `apps/web`:
//
//     node --env-file=.env.local scripts/test-user/reset.mjs            # default: not-onboarded, no sub
//     node --env-file=.env.local scripts/test-user/reset.mjs --onboarded-free
//     node --env-file=.env.local scripts/test-user/reset.mjs --onboarded-pro-active
//
// Modes:
//     (default)             — fresh signup state. Profile name/market cleared,
//                             onboarding_completed_at NULL, no sub row.
//                             Use for: A1-A4, B1, C1, D1-D5, E1-E7, F1-F2, K1.
//     --onboarded-free      — onboarding stamped, no sub row.
//                             Use for: B3 (onboarded user blocked from /onboarding/*),
//                             K1 from the post-Free-flow side.
//     --onboarded-pro-active — onboarding stamped, sub row with status='active'.
//                             Use for: H1 (direct hit on checkout when active),
//                             H2 (plan submit when already active).
//
// All three modes are idempotent — run repeatedly without ill effect. The
// user row in auth.users is never touched (use setup.mjs for that).

import { TEST_USER_EMAIL, getAdminClient, readTestUser } from './_shared.mjs'

function parseMode(argv) {
  const flag = argv.find((a) => a.startsWith('--'))
  if (!flag) return 'fresh'
  if (flag === '--onboarded-free') return 'onboarded-free'
  if (flag === '--onboarded-pro-active') return 'onboarded-pro-active'
  console.error(`✗ Unknown flag: ${flag}`)
  console.error('   Valid: --onboarded-free | --onboarded-pro-active')
  process.exit(1)
}

async function main() {
  const mode = parseMode(process.argv.slice(2))
  const stash = readTestUser()
  if (!stash) {
    console.error('✗ No .test-user.local.json. Run setup.mjs first.')
    process.exit(1)
  }
  const userId = stash.userId
  const admin = getAdminClient()

  // ----- 1. Always: clear processed_webhook_events for this user's events -----
  // We don't have an easy way to find this user's events specifically, so
  // skip — dedup table tolerates orphans, and full clear would break in-
  // progress tests on other users. Just call out for the runbook.

  // ----- 2. Always: delete the subscription row -----
  // For onboarded-pro-active we'll re-insert below. The webhook handler is
  // the only writer in production, but for tests we bypass it.
  {
    const { error } = await admin.from('subscriptions').delete().eq('user_id', userId)
    if (error) {
      console.error('✗ delete subscriptions failed:', error.message)
      process.exit(1)
    }
  }

  // ----- 3. Reset profile to baseline -----
  const profileBaseline = {
    first_name: null,
    last_name: null,
    market: null,
    has_visited_dashboard: false,
    onboarding_completed_at:
      mode === 'fresh' ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  {
    const { error } = await admin
      .from('profiles')
      .update(profileBaseline)
      .eq('id', userId)
    if (error) {
      console.error('✗ update profile failed:', error.message)
      process.exit(1)
    }
  }

  // ----- 4. Mode-specific: insert active sub for the pro-active branch -----
  if (mode === 'onboarded-pro-active') {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)

    const { error } = await admin.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      stripe_customer_id: `cus_e2e_${userId.replace(/-/g, '').slice(0, 14)}`,
      stripe_subscription_id: `sub_e2e_${userId.replace(/-/g, '').slice(0, 14)}`,
      current_period_end: periodEnd.toISOString(),
      entitlements: { speclyy: { plan: 'pro' } },
      // updated_at default is now() — let it be.
    })
    if (error) {
      console.error('✗ insert active subscription failed:', error.message)
      process.exit(1)
    }
  }

  console.log(`✓ Reset ${TEST_USER_EMAIL} (${userId}) → mode=${mode}`)
  console.log('')
  console.log('Tip: cookies.txt from a previous login.mjs run is still valid')
  console.log('     unless the JWT has expired. If middleware bounces you to')
  console.log('     /sign-in, re-run login.mjs to refresh the session.')
}

main().catch((err) => {
  console.error('✗ Unhandled:', err)
  process.exit(1)
})
