# E2E test user — billing/onboarding flow

A stable, password-confirmed Supabase user that lets `curl` (and Claude /
agents / future Playwright specs) drive the authenticated billing surface
without the OTP / magic-link round-trip. Designed as the unblocker for the
authed-session rows in `docs/implementation-tasks/billing-subscription/TEST-PLAN-billing-onboarding-flow.md`.

> **Scope:** dev / preview only. The scripts read `apps/web/.env.local` and
> talk to the test-mode Supabase project (`drjuzanqkrziknwhxjmn`). Never run
> against production.

---

## TL;DR

```bash
cd apps/web

pnpm test-user:setup       # one-time — creates the user, stashes a password
pnpm test-user:login       # signs in, dumps cookies.txt for curl
pnpm test-user:reset       # between test runs — back to fresh-signup state

# now use the cookie file with anything HTTP:
curl -b .test-cookies.txt http://localhost:3000/onboarding/plan -i
```

Three artefacts (all gitignored):

| File | What | Lifecycle |
|---|---|---|
| `apps/web/.test-user.local.json` | Email + password + user_id | Written by `setup`; read by `login`/`reset`. Persists across runs. |
| `apps/web/.test-cookies.txt` | Netscape-format auth cookies for `curl -b` | Written by `login`. Valid until the JWT expires (~1 h). Re-run `login` to refresh. |
| `apps/web/.test-user.local.json.tmp` | Crash-safe rename target | Cleaned up automatically. |

---

## Why a programmatic test user?

The sign-in form at `/sign-in` only exposes magic-link OTP and Google
OAuth (`apps/web/src/app/(auth)/sign-in/_components/sign-in-form.tsx`).
Both require an inbox we can read, which makes automated E2E painful.

Supabase's password grant is enabled on this project — it's just not
surfaced in the UI. We use the Auth Admin API (service-role) to:

1. Create a user with `email_confirm: true` (skips the OTP),
2. Set a known password,
3. Sign in via the standard `/auth/v1/token?grant_type=password` endpoint,
4. Capture the cookies that `@supabase/ssr` would have set on a real
   Next.js response, and
5. Dump them in a format `curl -b cookies.txt` understands.

The resulting cookie is byte-identical to what a real browser sign-in
would produce — middleware sees a valid session, pages call
`auth.getUser()` and get the test user back, RLS reads the right user
ID, and so on.

---

## The user

- **Email:** `billing-e2e@speclyy.local`
  `.local` is reserved by RFC 6762 (mDNS) so this domain can never resolve
  — there is zero risk of accidentally emailing a real user. Override
  with `E2E_TEST_USER_EMAIL=...` if you need a second test account.
- **Password:** generated fresh each `setup` run (24 base64url chars).
  Never logged. Stashed in `.test-user.local.json` (chmod 600).
- **User metadata:** `{ source: 'e2e-test', purpose: 'billing-flow' }` so
  it's distinguishable in the Supabase dashboard.
- **Confirmed at creation** (`email_confirm: true`) so the OTP flow is
  bypassed.

---

## Scripts

All run from `apps/web/`:

### `pnpm test-user:setup`

Idempotent. First run creates the user; subsequent runs *rotate the
password* on the existing user. Either way `.test-user.local.json` is
re-written with the freshly-generated password.

Use cases:
- First run on a new clone.
- Recovery if `.test-user.local.json` is lost or corrupted.
- Rotating credentials between long-lived branches.

### `pnpm test-user:login`

Signs in via password using `@supabase/ssr`'s server client with custom
`getAll`/`setAll` callbacks that capture the cookies into a buffer rather
than persisting them to a Next.js response. Dumps the buffer to
`.test-cookies.txt` in Netscape format for `curl -b`.

Run again any time the JWT looks stale — middleware-bounces to
`/sign-in` are the usual signal.

### `pnpm test-user:reset [--mode]`

Resets the user's billing + onboarding state without touching the
`auth.users` row. Three modes:

| Mode | What it sets | When to use |
|---|---|---|
| _(default)_ | `profiles.onboarding_completed_at = NULL`, name/market/dashboard cleared, `subscriptions` row deleted | **Fresh-signup baseline.** Use for: A1–A4, B1, C1, D1–D5, E1–E7, F1–F2, K1. |
| `--onboarded-free` | `profiles.onboarding_completed_at = NOW()`, no sub row | "User completed Free path." Use for: B3 (onboarded user blocked from `/onboarding/*`). |
| `--onboarded-pro-active` | Onboarded + a synthetic `subscriptions` row with `status='active'` and `entitlements.speclyy.plan='pro'` | "Already-Pro user." Use for: H1, H2 (active-sub guards). The `stripe_customer_id` / `stripe_subscription_id` use a `cus_e2e_…` / `sub_e2e_…` prefix so they're trivially distinguishable from real Stripe data and won't collide with anything in test mode. |

Reset is idempotent in every mode — re-run freely.

> **Why writes through service-role and not the webhook?** Webhook-driven
> setup requires `stripe listen` + completing a real payment in Stripe,
> which is exactly what we're trying to avoid. The synthetic sub row is
> good enough to exercise the page guards (which only check
> `status === 'active'`) and the middleware (which doesn't read
> `subscriptions` at all). For the Stripe round-trip itself (F1-F2, G2-G6,
> I-series), keep using `stripe listen` + a real test card.

---

## Worked example — verifying the previously-BLOCKED rows

With dev server running and `pnpm test-user:setup` + `pnpm test-user:login`
done once:

```bash
COOKIES=$(pwd)/.test-cookies.txt   # apps/web/.test-cookies.txt

# B4: not-onboarded user hits /projects → expect 307 → /onboarding/name
pnpm test-user:reset
curl -i -b $COOKIES http://localhost:3000/projects | grep -i location
# location: /onboarding/name   ✅

# B3: onboarded user hits /onboarding/plan → expect 307 → /projects
pnpm test-user:reset --onboarded-free
curl -i -b $COOKIES http://localhost:3000/onboarding/plan | grep -i location
# location: /projects   ✅

# H1: already-active user hits /onboarding/checkout → expect 307 → /projects
pnpm test-user:reset --onboarded-pro-active
curl -i -b $COOKIES http://localhost:3000/onboarding/checkout | grep -i location
# location: /projects   ✅

# A2: steady-state TTFB on /onboarding/plan (skip #1 for compile noise)
pnpm test-user:reset
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "  refresh $i: HTTP=%{http_code} TTFB=%{time_starttransfer}s\n" \
       -b $COOKIES http://localhost:3000/onboarding/plan
done
# refresh 1: TTFB ~340 ms (compile)
# refresh 2-5: TTFB ~265 ms median   ✅

# D1: plan page renders the expected copy
pnpm test-user:reset
curl -s -b $COOKIES http://localhost:3000/onboarding/plan |
  grep -oE "(Continue with Free|Select Pro plan|Starting from|Pick monthly or annual at checkout)" |
  sort -u
# Continue with Free
# Pick monthly or annual at checkout
# Starting from
```

---

## What it can't do

Anything that requires the *Stripe* side of the loop — the test user is
Supabase-only.

| Test plan section | Still requires |
|---|---|
| F1, F2 (payment success) | `stripe listen` + a Stripe test card in a real browser |
| G2, G3, G4, G5, G6 (payment failures) | Same — Stripe.js redirects/3DS modals don't survive curl |
| I3, I4, I5 (webhook events) | `stripe listen` + `stripe trigger` |
| J6 (subdomain SSO) | Production-like DNS for `*.speclyy.com` |

For those, use the test user as the signed-in identity but drive the
checkout with a real browser. The `--onboarded-*` reset flags + the
session cookie still help by letting you start each Stripe round-trip
from a known clean state.

---

## Lifecycle / hygiene

- The test user is created once and left in place. There's no automatic
  cleanup — running `setup` again rotates the password, but the user row
  in `auth.users` persists. If you want a clean slate, delete the user
  manually from the Supabase dashboard (Auth → Users → search
  `billing-e2e@speclyy.local` → Delete user).
- `.test-user.local.json` and `.test-cookies.txt` are gitignored
  (`.gitignore`, "E2E test-user credentials and session cookies"
  block). Both are chmod 600.
- The synthetic `subscriptions` rows the `--onboarded-pro-active` mode
  inserts use `cus_e2e_<...>` / `sub_e2e_<...>` IDs that don't exist in
  Stripe. The webhook handler will never see events for them; they're
  inert. `pnpm test-user:reset` (default mode) deletes them.
- Service-role calls bypass RLS, so the scripts can do things normal
  app code can't (insert subscription rows, clear `onboarding_completed_at`).
  Keep the scripts in `apps/web/scripts/test-user/` — never import this
  code from anywhere under `apps/web/src/`.

---

## Troubleshooting

**`✗ No .test-user.local.json found.`**
Run `pnpm test-user:setup` first.

**`✗ signInWithPassword failed: Invalid login credentials`**
The stashed password drifted from what's in Supabase. Run `pnpm
test-user:setup` to rotate, then `pnpm test-user:login`.

**`HTTP=307` and `location: /sign-in?next=…` on every authed request**
JWT expired (cookies are good for ~1 hour). Re-run `pnpm test-user:login`
to refresh. Cookie file is rewritten in place.

**`HTTP=307` and `location: /onboarding/name`**
That's middleware doing its job — your test user isn't onboarded.
Either expected (B4), or run `pnpm test-user:reset --onboarded-free`
first.

**Setup succeeds but login says "0 cookies captured".**
@supabase/ssr changed its cookie-write contract. Look at
`apps/web/scripts/test-user/_shared.mjs:getCaptureClient` and the
upstream `node_modules/.pnpm/@supabase+ssr@*/dist/module/cookies.js`.
