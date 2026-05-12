#!/usr/bin/env node
// Idempotent: creates (or rotates the password on) the e2e billing test user.
//
// Usage from `apps/web`:
//
//     node --env-file=.env.local scripts/test-user/setup.mjs
//
// Output:
//     - Writes `apps/web/.test-user.local.json` (gitignored) with the
//       email + password for downstream login.mjs / reset.mjs.
//     - Prints the email; never prints the password.
//
// What it does:
//     1. Looks up the user by email via service-role.
//     2. If missing → creates with `email_confirm: true` (no OTP needed) and a
//        random 24-char password.
//     3. If present → resets the password to a freshly-generated value (so
//        passwords are never stale across runs and we don't need to remember
//        what was set last time).
//     4. Writes the new password + user id to .test-user.local.json.

import {
  TEST_USER_EMAIL,
  TEST_USER_FILE,
  getAdminClient,
  generatePassword,
  writeTestUser,
} from './_shared.mjs'

async function findUserByEmail(admin, email) {
  // listUsers returns one page (default 50); we don't expect more than a
  // handful of users in a dev project. If you ever hit that ceiling, switch
  // to filter syntax: `listUsers({ filter: \`email eq "${email}"\` })`.
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
  }
}

async function main() {
  const admin = getAdminClient()
  const password = generatePassword()
  let userId
  let createdAt

  const existing = await findUserByEmail(admin, TEST_USER_EMAIL)
  if (existing) {
    console.log(`✓ Test user exists (${existing.id}). Rotating password.`)
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (error) {
      console.error('✗ updateUserById failed:', error.message)
      process.exit(1)
    }
    userId = existing.id
    createdAt = existing.created_at
  } else {
    console.log(`+ Creating test user ${TEST_USER_EMAIL}…`)
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { source: 'e2e-test', purpose: 'billing-flow' },
    })
    if (error) {
      console.error('✗ createUser failed:', error.message)
      process.exit(1)
    }
    userId = data.user.id
    createdAt = data.user.created_at
  }

  writeTestUser({ email: TEST_USER_EMAIL, password, userId, createdAt })
  console.log(`✓ Wrote ${TEST_USER_FILE}`)
  console.log(`  email:    ${TEST_USER_EMAIL}`)
  console.log(`  user_id:  ${userId}`)
  console.log(`  password: <stashed in .test-user.local.json — never printed>`)
  console.log('')
  console.log('Next: node --env-file=.env.local scripts/test-user/login.mjs')
}

main().catch((err) => {
  console.error('✗ Unhandled:', err)
  process.exit(1)
})
