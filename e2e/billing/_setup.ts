/**
 * Playwright setup helpers for the billing-flow specs.
 *
 * These run BEFORE Playwright's webServer fires up `pnpm dev`. We:
 *   1. Backup `apps/web/.env.local` to `.env.local.e2e-bak`.
 *   2. Boot `stripe listen` in the background, capture the printed
 *      `whsec_…`, write it into `.env.local` so the webhook handler can
 *      verify signatures from the events Stripe forwards.
 *   3. Provision the e2e test user via the existing
 *      `apps/web/scripts/test-user/setup.mjs` helper.
 *   4. Sign the test user in and capture the SSR-shaped cookies into a
 *      Playwright `storageState` JSON for tests to load.
 *
 * `_teardown.ts` restores the env file and kills `stripe listen` after
 * the suite finishes (or on Ctrl-C).
 *
 * State paths (all gitignored under `e2e/.tmp/`):
 *   - e2e/.tmp/storage-state.json        — Playwright storageState
 *   - e2e/.tmp/stripe-listen.log         — `stripe listen` stdout/stderr
 *   - e2e/.tmp/stripe-listen.pid         — pid for teardown
 *   - apps/web/.env.local.e2e-bak        — pre-run env backup
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Playwright's TS loader runs us in CommonJS; use the native __dirname.
// The repo root is two levels up from `e2e/billing/`.
const HERE = __dirname
export const REPO_ROOT = resolve(HERE, '../..')
export const APPS_WEB = resolve(REPO_ROOT, 'apps/web')
export const ENV_FILE = resolve(APPS_WEB, '.env.local')
export const ENV_BACKUP = resolve(APPS_WEB, '.env.local.e2e-bak')
export const TMP_DIR = resolve(HERE, '..', '.tmp')
export const STORAGE_STATE = resolve(TMP_DIR, 'storage-state.json')
export const STRIPE_LOG = resolve(TMP_DIR, 'stripe-listen.log')
export const STRIPE_PID_FILE = resolve(TMP_DIR, 'stripe-listen.pid')
export const DEV_LOG = resolve(TMP_DIR, 'dev.log')
export const DEV_PID_FILE = resolve(TMP_DIR, 'dev.pid')
export const TEST_USER_EMAIL = 'billing-e2e@speclyy.local'
export const TEST_USER_FILE = resolve(APPS_WEB, '.test-user.local.json')
export const DEV_PORT = Number(process.env.E2E_DEV_PORT ?? 3000)
export const BASE_URL = `http://localhost:${DEV_PORT}`

// ------------------------------------------------------------------
// .env.local read/write — minimal-edit, line-addressable
// ------------------------------------------------------------------

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function writeEnvKey(key: string, value: string): void {
  const lines = readFileSync(ENV_FILE, 'utf8').split('\n')
  let touched = false
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`
      touched = true
      break
    }
  }
  if (!touched) lines.push(`${key}=${value}`)
  writeFileSync(ENV_FILE, lines.join('\n'))
}

// ------------------------------------------------------------------
// stripe listen process management
// ------------------------------------------------------------------

/**
 * Spawn `stripe listen` and resolve once it prints its `whsec_…` line.
 * Times out at 15 s — usually it's ready in <2 s. PID is stashed so
 * teardown can clean up even if the harness crashes mid-test.
 */
async function bootStripeListen(): Promise<{ whsec: string; pid: number }> {
  mkdirSync(TMP_DIR, { recursive: true })
  // Truncate previous log so the secret-grep below only sees this run's output.
  writeFileSync(STRIPE_LOG, '', 'utf8')

  const child: ChildProcess = spawn(
    'stripe',
    ['listen', '--forward-to', 'http://localhost:3000/api/webhooks/stripe'],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: false },
  )

  if (!child.pid) throw new Error('failed to spawn stripe listen')
  writeFileSync(STRIPE_PID_FILE, String(child.pid))

  // Tee both streams to the log file so anything weird is captured.
  child.stdout?.on('data', (chunk) => writeAppend(STRIPE_LOG, chunk))
  child.stderr?.on('data', (chunk) => writeAppend(STRIPE_LOG, chunk))

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const buf = readFileSync(STRIPE_LOG, 'utf8')
    const m = buf.match(/whsec_[A-Za-z0-9]+/)
    if (m) return { whsec: m[0], pid: child.pid }
    if (child.exitCode !== null) {
      throw new Error(`stripe listen exited early (code ${child.exitCode}); see ${STRIPE_LOG}`)
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for stripe listen secret; see ${STRIPE_LOG}`)
}

function writeAppend(path: string, chunk: Buffer | string): void {
  // node fs has no append-mode-friendly synchronous API that's easy here;
  // read-modify-write is fine for sub-MB log files.
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, prev + chunk.toString('utf8'))
}

// ------------------------------------------------------------------
// Dev-server lifecycle (we manage it ourselves so env mutations land
// before `next dev` reads them)
// ------------------------------------------------------------------

/** Returns true if anything is listening on the configured dev port. */
function isPortInUse(port: number): boolean {
  // `lsof -i :PORT -t` prints pids on stdout, exits 0 if any. Mac-friendly.
  const r = spawnSync('lsof', ['-i', `:${port}`, '-t'], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim().length > 0
}

function killExistingDev(port: number): void {
  const r = spawnSync('lsof', ['-i', `:${port}`, '-t'], { encoding: 'utf8' })
  if (r.status !== 0) return
  for (const pid of r.stdout.trim().split(/\s+/).map(Number).filter(Boolean)) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

// ------------------------------------------------------------------
// Stripe-side cleanup — every payment-success test creates a new Stripe
// customer (the action only reuses an existing one when a `subscriptions`
// row is present, which `resetUser('fresh')` deletes). Across many runs
// the test user accumulates dozens of orphan customers, slowing the
// Elements iframe and occasionally causing payment redirects to hang.
// Wipe them at the start of every suite so each run is reproducible.
// ------------------------------------------------------------------

async function cleanupStripeCustomers(secretKey: string): Promise<number> {
  const stripe = new Stripe(secretKey)
  let deleted = 0
  // `customers.list({ email })` is exact-match by email — perfect for this.
  // 100 per page is plenty (we'd be in trouble already if more accumulated).
  const customers = await stripe.customers.list({ email: TEST_USER_EMAIL, limit: 100 })
  for (const customer of customers.data) {
    try {
      await stripe.customers.del(customer.id)
      deleted += 1
    } catch (err) {
      // Already deleted / customer with active sub that won't delete cleanly —
      // log and continue. Not worth failing the suite over.
      console.warn(`[e2e/setup]   ! customer ${customer.id} delete failed:`, err)
    }
  }
  return deleted
}

async function bootDevServer(): Promise<number> {
  // Make sure any pre-existing dev (mine, the user's, or a previous run's) is
  // gone — they'd be running with the OLD STRIPE_WEBHOOK_SECRET.
  if (isPortInUse(DEV_PORT)) {
    console.log(`[e2e/setup]   • Port ${DEV_PORT} in use; killing existing process(es).`)
    killExistingDev(DEV_PORT)
    // Give the OS a moment to release the port.
    await sleep(800)
  }

  writeFileSync(DEV_LOG, '', 'utf8')
  const child = spawn('pnpm', ['--filter', '@speclyy/web', 'dev'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(DEV_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })
  if (!child.pid) throw new Error('failed to spawn pnpm dev')
  writeFileSync(DEV_PID_FILE, String(child.pid))

  child.stdout?.on('data', (chunk) => writeAppend(DEV_LOG, chunk))
  child.stderr?.on('data', (chunk) => writeAppend(DEV_LOG, chunk))

  // Wait for "Ready in …" — printed once Next is serving on the port.
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (existsSync(DEV_LOG) && /Ready in /.test(readFileSync(DEV_LOG, 'utf8'))) {
      // Drift-proof: also confirm the port answers.
      try {
        const res = await fetch(BASE_URL + '/', { redirect: 'manual' })
        if (res.status > 0) return child.pid
      } catch {
        /* not yet */
      }
    }
    if (child.exitCode !== null) {
      throw new Error(`pnpm dev exited early (code ${child.exitCode}); see ${DEV_LOG}`)
    }
    await sleep(500)
  }
  throw new Error(`Timed out waiting for dev server on ${BASE_URL}; see ${DEV_LOG}`)
}

// ------------------------------------------------------------------
// Test user provisioning + storage-state generation
// ------------------------------------------------------------------

/**
 * Mirror of `apps/web/scripts/test-user/setup.mjs` but inlined here so
 * the Playwright harness can drive everything without shell-out.
 */
async function ensureTestUser(env: Record<string, string>): Promise<{ userId: string; password: string }> {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const password = generatePassword()
  let userId: string

  // listUsers paginates; we expect <200 users in dev.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  const existing = data.users.find((u) => u.email === TEST_USER_EMAIL)

  if (existing) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (updateErr) throw updateErr
    userId = existing.id
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { source: 'e2e-test', purpose: 'billing-flow' },
    })
    if (createErr) throw createErr
    userId = created.user.id
  }

  // Stash for the helper scripts the user might run between Playwright runs.
  writeFileSync(
    TEST_USER_FILE,
    JSON.stringify({ email: TEST_USER_EMAIL, password, userId, createdAt: new Date().toISOString() }, null, 2) + '\n',
    { mode: 0o600 },
  )

  return { userId, password }
}

function generatePassword(): string {
  // Same scheme as scripts/test-user/_shared.mjs.
  // 24 base64url chars ≈ 144 bits.
  const bytes = new Uint8Array(18)
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Sign the test user in via password and turn the SSR-emitted cookies into
 * a Playwright `storageState` JSON. Cookies are scoped to BOTH `localhost`
 * and `127.0.0.1` so tests can use either.
 */
async function writeStorageState(
  env: Record<string, string>,
  password: string,
): Promise<{ userId: string; expiresAt: number }> {
  const writes: { name: string; value: string; options?: { path?: string; maxAge?: number } }[] = []

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => writes.push(...cookiesToSet),
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password,
  })
  if (error) throw error
  if (writes.length === 0) throw new Error('No cookie writes captured from supabase/ssr')

  // Playwright storageState shape:
  //   { cookies: [{ name, value, domain, path, expires, httpOnly, secure, sameSite }], origins: [] }
  const expiresAt = data.session?.expires_at ?? Math.floor(Date.now() / 1000) + 3600
  const playwrightCookies = writes.flatMap(({ name, value, options }) => {
    const path = options?.path ?? '/'
    const maxAge = options?.maxAge ?? 60 * 60 * 24 * 365
    const expires = Math.floor(Date.now() / 1000) + maxAge
    return ['localhost', '127.0.0.1'].map((domain) => ({
      name,
      value,
      domain,
      path,
      expires,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    }))
  })

  mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: playwrightCookies, origins: [] }, null, 2))

  return { userId: data.user.id, expiresAt }
}

// ------------------------------------------------------------------
// Public entrypoints
// ------------------------------------------------------------------

export default async function globalSetup(): Promise<void> {
  console.log('[e2e/setup] Starting billing-flow test infrastructure…')

  // 1. Backup env (idempotent — only backup if a backup doesn't exist; on
  //    a clean run teardown will remove it).
  if (!existsSync(ENV_BACKUP)) {
    copyFileSync(ENV_FILE, ENV_BACKUP)
    console.log(`[e2e/setup]   ✓ Backed up env → ${ENV_BACKUP}`)
  } else {
    console.log(`[e2e/setup]   • Reusing existing env backup at ${ENV_BACKUP}`)
  }

  // 2. Boot stripe listen + capture secret.
  const { whsec, pid } = await bootStripeListen()
  console.log(`[e2e/setup]   ✓ stripe listen ready (pid ${pid}, secret captured)`)
  writeEnvKey('STRIPE_WEBHOOK_SECRET', whsec)
  console.log(`[e2e/setup]   ✓ Wrote STRIPE_WEBHOOK_SECRET into ${ENV_FILE}`)

  // 3. Provision test user (idempotent; rotates password).
  const env = readEnv()
  const { userId, password } = await ensureTestUser(env)
  console.log(`[e2e/setup]   ✓ Test user ${TEST_USER_EMAIL} ready (${userId})`)

  // 4. Sign in and write storage-state.
  const { expiresAt } = await writeStorageState(env, password)
  console.log(
    `[e2e/setup]   ✓ Storage state at ${STORAGE_STATE} (expires ${new Date(expiresAt * 1000).toISOString()})`,
  )

  // 5. Wipe accumulated Stripe customers for this test user.
  const wiped = await cleanupStripeCustomers(env.STRIPE_SECRET_KEY)
  console.log(`[e2e/setup]   ✓ Cleaned up ${wiped} stale Stripe customer(s) for the test user`)

  // 6. Boot dev server with the freshly-written env.
  console.log(`[e2e/setup]   • Booting dev server on :${DEV_PORT}…`)
  const devPid = await bootDevServer()
  console.log(`[e2e/setup]   ✓ Dev server ready (pid ${devPid}, log: ${DEV_LOG})`)

  console.log('[e2e/setup] Done.')
}

// renameSync is re-exported for the teardown module's convenience.
export { renameSync }
