#!/usr/bin/env node
// Sign in as the e2e test user via password and dump the SSR-shaped cookies
// to a Netscape `cookies.txt` file `curl -b` can use.
//
// Usage from `apps/web`:
//
//     node --env-file=.env.local scripts/test-user/login.mjs
//
// Pre-req: scripts/test-user/setup.mjs has been run (creates the user +
// stashes a password in .test-user.local.json).
//
// Mechanics:
//     We use `@supabase/ssr`'s `createServerClient` with custom getAll/setAll
//     callbacks that capture rather than persist. supabase-js calls our
//     setAll after a successful signInWithPassword, handing us the cookies
//     it would have set on a real Next.js response. We dump those, in the
//     exact format @supabase/ssr expects to re-read, so curl carries a
//     session indistinguishable from a real browser sign-in.

import { writeFileSync } from 'node:fs'

import {
  COOKIES_FILE,
  TEST_USER_EMAIL,
  getCaptureClient,
  readTestUser,
  toNetscapeCookies,
} from './_shared.mjs'

async function main() {
  const stash = readTestUser()
  if (!stash || !stash.password) {
    console.error('✗ No .test-user.local.json found. Run setup.mjs first.')
    process.exit(1)
  }
  if (stash.email !== TEST_USER_EMAIL) {
    console.error(
      `✗ E2E_TEST_USER_EMAIL mismatch: stash has ${stash.email}, env wants ${TEST_USER_EMAIL}.`,
    )
    process.exit(1)
  }

  const writes = []
  const supabase = getCaptureClient(writes)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: stash.email,
    password: stash.password,
  })
  if (error) {
    console.error('✗ signInWithPassword failed:', error.message)
    process.exit(1)
  }

  if (writes.length === 0) {
    // Defensive — supabase-js v2 always calls setAll on a successful sign-in.
    // If we land here, the API contract changed.
    console.error('✗ No cookie writes captured. @supabase/ssr behavior changed?')
    process.exit(1)
  }

  // Cookies are emitted for both `localhost` and `127.0.0.1` so curl works
  // regardless of which form is typed (curl matches the Host header
  // literally; a cookie scoped to one wouldn't be sent to the other).
  // Override with E2E_COOKIE_HOSTS=foo,bar (see `_shared.mjs`).
  writeFileSync(COOKIES_FILE, toNetscapeCookies(writes), { mode: 0o600 })

  console.log(`✓ Signed in as ${stash.email}`)
  console.log(`  user_id:    ${data.user.id}`)
  console.log(`  expires_at: ${new Date((data.session?.expires_at ?? 0) * 1000).toISOString()}`)
  console.log(`  cookies:    ${COOKIES_FILE} (${writes.length} cookie(s) × {localhost, 127.0.0.1})`)
  console.log('')
  console.log('Use with curl:')
  console.log(`  curl -b ${COOKIES_FILE} http://localhost:3000/onboarding/plan -i`)
  console.log(`  curl -b ${COOKIES_FILE} http://127.0.0.1:3000/onboarding/plan -i  # also works`)
}

main().catch((err) => {
  console.error('✗ Unhandled:', err)
  process.exit(1)
})
