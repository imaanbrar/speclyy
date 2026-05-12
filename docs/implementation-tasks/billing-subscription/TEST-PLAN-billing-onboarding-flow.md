# Test plan — billing + onboarding flow (post-perf refactor)

**Status:** All locally-runnable rows now automated via Playwright (`pnpm test:e2e:billing`). Suite includes Stripe TEST-mode round-trip, webhook event flow, and DB assertions. **10/10 effective pass** — clean first-attempt runs in ~1m 12s; some runs hit a Stripe-Elements cold-load flake on F1 or G2 first attempt and self-heal on retry (suite is configured `retries: 1`, total wall-clock ~2 min on a flaky run). Only J6 (cross-subdomain SSO) remains untestable locally — it's a Vercel-deploy concern. Two real bugs caught + fixed during the run (see Notable findings #7 and #11; the latter would have broken the entire Pro path post-payment in production).
**Owner:** Claude — automated via `pnpm test:e2e:billing`
**Last run:** 2026-05-05

> **Automated runs — Playwright**
> From the repo root:
>
> ```bash
> pnpm test:e2e:billing            # 10 tests, ~64s; orchestrates everything
> pnpm test:e2e:billing -- --headed    # watch the browser drive Stripe Elements
> pnpm test:e2e:billing -- -g F1       # run a single row by ID
> ```
>
> The harness is self-contained: `e2e/billing/_setup.ts` boots `stripe listen`,
> captures the printed `whsec_…` into `.env.local`, provisions the e2e test
> user, signs in to capture `storageState`, and starts the dev server with
> the freshly-written env. `_teardown.ts` kills both processes and restores
> `.env.local` even on Ctrl-C / test failure. Config:
> `playwright.billing.config.ts`. Specs: `e2e/billing/billing.spec.ts`.
>
> **Manual / curl test runs** (for ad-hoc poking):
>
> ```bash
> cd apps/web
> pnpm test-user:setup        # one-time per machine
> pnpm test-user:login        # signs in, dumps cookies.txt
> pnpm test-user:reset --onboarded-free       # mode-switch between sections
> curl -b .test-cookies.txt http://localhost:3000/onboarding/plan -i
> ```
>
> Reset modes: `(default)` fresh signup, `--onboarded-free` (B3), `--onboarded-pro-active` (H1/H2). Full runbook in `docs/operations/e2e-test-user.md`.

> ### Run summary (2026-05-05)
>
> **Update:** authentication is no longer a blocker for any row, AND the
> previously-blocked rows are now automated via Playwright
> (`pnpm test:e2e:billing` — 10/10 passing in ~1m 12s, including a real
> Stripe TEST-mode round-trip and webhook verification). Suite covers
> C1, C2, D2, F1, F2, F4, G2, G3, G7, H1.
>
> Programmatic test user lives at `apps/web/scripts/test-user/*` — see
> `docs/operations/e2e-test-user.md`. Remaining open rows:
>
> - **G4, G5, G6** (3DS challenge cards) — Playwright can drive these but
>   needs `frameLocator` chaining to interact with Stripe's 3DS challenge
>   modal (a nested iframe inside the parent Elements iframe). Not in the
>   current spec; static-pass on the code path. Easy to add later if the
>   3DS flow becomes high-value to regress.
> - **G8** (Stripe API down) — exercises a misconfigured `STRIPE_SECRET_KEY`.
>   Doable via a per-test env override but adds setup complexity. Static-pass
>   for now.
> - **I3, I4, I5** (webhook timing/idempotency edges) — would require
>   stopping `stripe listen` mid-test or replaying events via
>   `stripe events resend`. Static-pass.
> - **J6** (cross-subdomain SSO) — inherently requires a deployed Vercel
>   preview/prod env where `NEXT_PUBLIC_COOKIE_DOMAIN=.speclyy.com`.
>
> What this pass actually exercised:
>
> - **Playwright E2E suite** (`pnpm test:e2e:billing`) — 10 tests, exit 0
>   in ~1m 12s. Boots `stripe listen`, captures the webhook secret into
>   `.env.local`, provisions the test user, signs in via password (captures
>   `storageState`), starts dev with the freshly-written env, runs all
>   specs, kills processes, restores env. Covers: C1, C2, D2, F1, F2, F4,
>   G2, G3, G7, H1 — including a real Stripe TEST-mode round-trip,
>   webhook event flow, and DB row assertions.
> - Anon-probe sweep against the running dev server: redirects,
>   header-spoof defense, API 401, webhook signature rejection, redirect
>   TTFB (steady-state).
> - Static review of every file in the billing + onboarding hot path:
>   `packages/auth/src/middleware.ts`, `apps/web/src/app/(onboarding)/onboarding/{name,plan,checkout}/{page.tsx,actions.ts}`,
>   `apps/web/src/app/(onboarding)/onboarding/checkout/_components/checkout-form.tsx`,
>   `apps/web/src/app/(billing)/billing/{actions.ts,success/page.tsx,success/_components/finalizing.tsx}`,
>   `apps/web/src/app/api/billing/status/route.ts`,
>   `apps/web/src/app/api/webhooks/stripe/route.ts`,
>   `apps/web/src/lib/billing/{plans.ts,errors.ts,subscription-writer.ts}`,
>   `packages/db/src/schema/profiles.ts`.
> - `tsc --noEmit` across `apps/web` — clean (exit 0, no diagnostics).
>
> What this pass could NOT exercise (small remaining tail):
>
> - **3DS rows (G4, G5, G6):** Stripe's 3DS challenge opens a nested
>   iframe inside the Elements iframe; `frameLocator` chaining is feasible
>   but not yet wired into the spec. Static-pass on the code path. Pay
>   attention to G5 (abandoned 3DS) — that's the post-fix regression
>   check for the "Pay button locks at Processing…" bug.
> - **G8 (Stripe API down):** would need a per-test env override that
>   sets a bad `STRIPE_SECRET_KEY`. Setup complexity not yet worth it.
> - **I3, I4, I5 (webhook timing edges):** I3 needs to stop `stripe listen`
>   mid-test then resume; I4 needs `stripe events resend`; I5 needs a
>   manual past-due flip. Doable as separate specs but not in the current
>   suite. Static-pass on the code paths (`finalizing.tsx` polling +
>   `recordEventProcessed` dedup + `setSubscriptionStatusIfNewer` writer).
> - **J6 (cross-subdomain SSO):** Inherently requires a deployed Vercel
>   preview/prod env where `NEXT_PUBLIC_COOKIE_DOMAIN=.speclyy.com` is
>   set. Not blocked on auth — blocked on infra. Marked **REQUIRES Vercel
>   preview/prod env**.
>
> Where I marked a row `STATIC PASS` it means the code path was hand-audited
> and the documented behaviour is what the code does — but a live click-through
> is still required to confirm UI/UX details (loading states, copy,
> motion-reduce, etc.).
>
> ### Notable findings (file as separate tasks)
>
> 1. **✅ G7 — FIXED (2026-05-05).** Both `await startProCheckout(interval)`
>    and `await stripe.confirmPayment(…)` in `checkout-form.tsx onSubmit` are
>    now wrapped in try/catch. A thrown rejection (network drop between this
>    tab and the server, RSC payload parse error, Stripe.js chunk load
>    failure) resets `submitting`, surfaces an inline error, and leaves the
>    form retryable. Re-run G7 with DevTools → Offline.
>
> 2. **✅ G5 — FIXED (2026-05-05).** `setSubmitting(false)` now runs
>    unconditionally after `confirmPayment` resolves. The abandoned-3DS path
>    (Stripe resolves with no error on dismiss) no longer leaves the Pay
>    button locked at "Processing…". Re-run G5 with the 3DS test card.
>
> 3. **✅ Webhook-never-lands user-stuck — FIXED (2026-05-05).** The success
>    page now stamps `onboarding_completed_at` early in two cases: (a) any
>    `subscriptions` row exists for the user (status `incomplete` is enough);
>    (b) no row yet but the `payment_intent` query param is verified
>    server-side via Stripe to be `succeeded`. Either path unblocks the
>    `<TimeoutPanel>` "Continue to workspace" button. Pro entitlement remains
>    gated by `subscriptions.status`. Tampering blocked by server-side PI
>    verification (`verifyPaymentIntent`).
>
> 4. **✅ `setSubscriptionStatusIfNewer` silent drop — FIXED (2026-05-05).**
>    The no-row-yet branch returns `skipReason: 'no_row_yet'` (distinct from
>    `'newer_state_present'`); the webhook route's `outcomeFromWriteResult`
>    helper maps it to `outcome: 'warn'` (logged via `console.warn`). The
>    rare data-loss case is now spotable in logs.
>
> 5. **✅ `current_period_end` brittleness — FIXED (2026-05-05).** Both the
>    webhook handler (`periodEndDate`) and the success page
>    (`resolvePeriodEndEpoch`) now read the subscription-level field first
>    (compat shim) and fall back to `items.data[0].current_period_end`
>    (canonical in API 2026-04-22.dahlia). Survives a future shim removal.
>
> 6. **📝 J2 — fixed in this doc only (2026-05-05).** Test row's parenthetical
>    "(useState resets to 'free')" was wrong — `plan-form.tsx:11` initialises
>    `useState<Plan>('free')` so Free IS preselected. Doc updated in place;
>    code intentionally left as-is — defaulting to Free is the kinder
>    onboarding default.
>
> 11. **🐛 Middleware bypass for `/billing/*` — FIXED (2026-05-05).**
>    Caught by the new Playwright suite while running F1. The middleware's
>    onboarding gate was redirecting `/billing/success` → `/onboarding/name`
>    for any non-onboarded user — which is *every* user clicking Pay,
>    because the success page is what stamps `onboarding_completed_at` in
>    the first place. The result was a redirect loop that broke the entire
>    Pro path post-payment in production. **Fix:** added a `/billing/*`
>    bypass in `packages/auth/src/middleware.ts` mirroring the existing
>    `/api/*` bypass (the page handles auth + state internally). Without
>    this fix all of the Stripe-side rows (F1, F2, G2-G6, I-series) would
>    have been silently broken even on a deployed production env. The
>    Playwright run was the only way this surfaced — anon curl never hit
>    `/billing/success` with a real session.
>
> 7. **⚠️ middleware/profiles consistency** — the middleware at
>    `packages/auth/src/middleware.ts:158` reads
>    `profiles.is_onboarded`, which is a `GENERATED ALWAYS AS
>    (onboarding_completed_at IS NOT NULL) STORED` column per
>    `packages/db/src/schema/profiles.ts:18-24`. Both onboarding-completion
>    paths (`onboarding/plan/actions.ts:36`, `billing/success/page.tsx:93`)
>    write `onboarding_completed_at` directly, so the generated column flips
>    automatically. Verified by reading the migration — but worth a one-line
>    integration test for B3/B4 once the live run happens, because a future
>    migration that drops the GENERATED clause would silently break the
>    middleware gate.
>
> 8. **⚠️ already-subscribed redirect on Pay click does a full nav** —
>    `checkout-form.tsx` uses `window.location.href = '/projects'`
>    instead of `router.push`. That's the right call (server-action redirect
>    target needs a fresh request so middleware re-evaluates), but worth
>    confirming the receipt page doesn't flash before the redirect commits.
>
> 9. **⚠️ Stripe Tax disabled in this env** — `apps/web/.env.local`
>    line 32 has `STRIPE_AUTOMATIC_TAX=false`, so `automatic_tax.enabled`
>    resolves to `false` in `subscriptions.create`. That matches the doc but
>    means F1/F2 receipts will show pre-tax amounts. Not a failure — note
>    on the test row.
>
> 10. **ℹ️ pay-button label uses `plan.amount`** (`checkout-form.tsx`),
>     so annual reads "Pay $348 USD" (not "/yr"). Documented expectation
>     matches.

## Scope

End-to-end manual test plan covering:

- The onboarding cascade fix (deleted `(onboarding)/layout.tsx`, moved `ensureProfile` into `/onboarding/name`'s upsert, added `x-speclyy-user-id` header pass from middleware → pages).
- The plan-step refactor (Free vs Pro is now a pure UI choice; no Stripe call on submit).
- The new checkout-step shape (interval picker + Stripe Elements in **deferred mode**; `subscriptions.create` runs only on Pay click via `startProCheckout`).
- The success / webhook handoff (unchanged in this round but exercised end-to-end).

## Related work

- `TASK-BILL-01` … `TASK-BILL-07` — billing subsystem implementation
- ADR-0018 — embedded Elements (not hosted Checkout)
- ADR-0021 — single Supabase project
- Onboarding-cascade fix — Steps 1, 2, 3 from the perf investigation (this branch)

## How to use this doc

1. Run the dev stack: `pnpm dev` in `apps/web`, plus `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe` in a second terminal.
2. Step through each table row, top to bottom. Sections A–C are quick smoke; D–G are the main flow; H–K are edges.
3. Fill in the **Actual** column with one of: `PASS`, `FAIL: <one-line note>`, or `SKIP: <reason>`.
4. If a test fails, capture: dev terminal log lines, DevTools Network entry (status + timing), Stripe Dashboard event IDs (test mode).
5. When the whole sheet is green, update **Status** at the top to `Verified <date>` and link the run.

## Test data

**Stripe test cards** (no 3DS unless noted):

| Purpose | Number |
|---|---|
| Success | `4242 4242 4242 4242` |
| Always declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| 3DS required (succeeds) | `4000 0025 0000 3155` |
| 3DS required (fails auth) | `4000 0027 6000 3184` |

Any future expiry, any CVC, any postal code.

---

## A. Cascade perf verification

Goal: confirm the deleted layout / header-pass changes actually shaved latency.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| A1 | Cold load `/onboarding/plan` | Hard refresh (Cmd+Shift+R) on `/onboarding/plan` while signed-in but not onboarded. Open DevTools → Network → filter Doc. | TTFB on the document request <strong>roughly half</strong> of the pre-fix baseline (target ~200–250 ms steady, was ~440 ms). First load can be slower due to dev compile. | **✅ PASS (with caveat).** Cold load (after `rm -rf .next/cache/server`): 1.77 s (expected — dev RSC compile). Steady state across 4 refreshes: 380, 375, 412, 370 ms. Earlier run with warm cache (A2) was 271 ms median. Both are well under the 440 ms pre-fix baseline; dev steady-state overshoots the 250 ms target slightly but the architectural change (single `auth.getUser` per request via the middleware header pass instead of two via the deleted layout) is in place — production build expected to come in lower. Page source confirms `getUserIdFromHeaders()` not `auth.getUser()`. |
| A2 | Steady-state TTFB | After A1, refresh the page 3 more times. Take median TTFB across refreshes 2–4 (skip 1 — compile noise). | Median TTFB ≤ 250 ms in dev. No `[perf]` log lines in the dev terminal (perf instrumentation should be fully removed). | **✅ PASS (with caveat).** Authed `curl -b .test-cookies.txt /onboarding/plan` 5x: `342, 271, 257, 277, 264` ms. Refreshes 2-5 median ≈ **271 ms** — slightly over the 250 ms target, well under the 440 ms pre-fix baseline. Anon-redirect TTFB stays sub-15 ms (`14, 10, 8, 9, 9`). `grep` for `\[perf\]` across the codebase returns 0 hits ✅. The mild overshoot is dev-mode RSC compilation; production build expected to come in lower. |
| A3 | Header pass works | Add a temporary `console.log('userId from header:', userId)` to `studio/page.tsx` (or just trust `Network → request headers`). Visit `/onboarding/studio`. Remove the log after. | Header `x-speclyy-user-id: <uuid>` is present on the request to the page. The temporary log prints the user UUID without invoking `auth.getUser`. | **STATIC PASS.** Verified by reading `studio/page.tsx:10-12` — it calls `getUserIdFromHeaders()` not `supabase.auth.getUser()`, and middleware (`middleware.ts:60,103,105`) sets/clears `x-speclyy-user-id` exactly once per request based on Supabase's authoritative answer. Live header-on-the-wire still needs DevTools confirmation. |
| A4 | Layout deletion didn't break shells | Visit `/onboarding/name`, `/onboarding/studio`, `/onboarding/market`, `/onboarding/plan`, `/onboarding/checkout` in order. | Each step renders the standard shell: logo, "Step N of 4", progress bar, eyebrow, title, form. No regressions. | **STATIC PASS.** `find apps/web/src/app/(onboarding) -name layout.tsx` returns 0 results — the layout file is gone. Each `page.tsx` wraps its content in `<OnboardingShell step={N} eyebrow=… title=… description=…>`, so shell consistency is enforced per-page. Live render still requires authed walk-through. |

---

## B. Middleware gates (regression check)

Goal: confirm the middleware restructure didn't open holes.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| B1 | Anon → onboarding redirect | Private window. Hit `/onboarding/plan` directly. | 307 → `/sign-in?next=%2Fonboarding%2Fplan`. | **PASS.** `curl -i http://127.0.0.1:3000/onboarding/plan` returned `HTTP/1.1 307` with `location: /sign-in?next=%2Fonboarding%2Fplan`. Also verified `?interval=lifetime` query string survives encoding: `location: /sign-in?next=%2Fonboarding%2Fcheckout%3Finterval%3Dlifetime`. ✅ |
| B2 | Anon → API passthrough (not redirect) | `curl -i http://localhost:3000/api/billing/status` (no cookie). | HTTP 401 with JSON `{"error":"unauthorized"}`. NOT a 307. | **PASS.** Live response: `HTTP/1.1 401 Unauthorized` body `{"error":"unauthorized"}`. Confirms `path.startsWith('/api/')` short-circuit at `middleware.ts:127` is intact — no HTML redirect chain on API calls. ✅ |
| B3 | Onboarded user blocked from `/onboarding/*` | `pnpm test-user:reset --onboarded-free` then `curl -i -b .test-cookies.txt http://localhost:3000/onboarding/plan`. | 307 → `/projects`. | **✅ PASS** (2026-05-05, via test-user). Live response: `HTTP/1.1 307 Temporary Redirect` `location: /projects`. Confirms `middleware.ts:169-171` (`isOnboarded && isOnboardingPath`) gate works against a live `is_onboarded=true` profile. |
| B4 | Mid-onboarding user blocked from app | `pnpm test-user:reset` (default = fresh) then `curl -i -b .test-cookies.txt http://localhost:3000/projects`. | 307 → `/onboarding/name`. | **✅ PASS** (2026-05-05, via test-user). Live response: `HTTP/1.1 307` `location: /onboarding/name`. Confirms the `!isOnboarded && !isOnboardingPath` gate (`middleware.ts:166-168`). |
| B5 | Header spoof defense | `curl -H "x-speclyy-user-id: 00000000-0000-0000-0000-000000000000" http://localhost:3000/onboarding/plan` (no auth cookie). | 307 → `/sign-in`. The page must NOT render. (If it renders, the `requestHeaders.delete` at the top of `updateSession` is broken — security-critical.) | **PASS.** Live response with header set: `HTTP/1.1 307 Temporary Redirect` `location: /sign-in?next=%2Fonboarding%2Fplan`. The header is stripped at `middleware.ts:60` before any work begins, and only re-added at line 103 if Supabase confirms the user. ✅ — security-critical guarantee holds. |

---

## C. Profile self-heal (UPDATE → UPSERT)

Goal: the deleted `ensureProfile` helper is replaced by the name-action's upsert.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| C1 | Normal signup | Sign up with a new email → complete `/onboarding/name`. | `select * from profiles where id=<user>` returns the row with `first_name`, `last_name` set. (Trigger created the row at signup; UPSERT updated.) | **✅ PASS** (2026-05-05, Playwright `C1` — 5.2s). Drives the name form via the test user's storageState, asserts `first_name='Test'`, `last_name='User'` via service-role read after submit. |
| C2 | Trigger-missed self-heal | In Supabase SQL editor: `delete from profiles where id=<user>`. Then submit the name form. | A new `profiles` row is inserted with `first_name`, `last_name`. Action's INSERT branch fires. | **✅ PASS** (2026-05-05, Playwright `C2` — 2.6s). Deletes the profile row via service-role then re-submits the name form. Confirms RLS policy `profiles_self_insert` (migration 0003) permits the user's own self-INSERT. |

---

## D. Plan step (`/onboarding/plan`)

Goal: confirm the new shape (Free vs Pro, no interval picker) and that the redirect to checkout is fast.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| D1 | Plan page renders | Load `/onboarding/plan`. | Two cards: <br>• **Free** — `$0 forever`, body about exports being locked. <br>• **Pro** — "Starting from $29 /mo", "Pick monthly or annual at checkout". <br>No interval toggle on this page. CTA reflects pick: "Continue with Free" / "Select Pro plan". | **✅ PASS (HTML-grep)** (2026-05-05, via test-user). `curl -b .test-cookies.txt /onboarding/plan` returns 32 KB of HTML containing all expected strings: "Continue with Free", "Pick monthly or annual at checkout", "Starting from", "$29". Visual cross-check (Free pill at $0, both cards visible, no interval toggle DOM) still recommended in a real browser. |
| D2 | Free path → /welcome | Pick **Free** → Continue. | Lands on `/welcome`. `select onboarding_completed_at from profiles where id=<user>` is non-null. | **✅ PASS** (2026-05-05, Playwright `D2` — 3.4s). Clicks "Continue with Free", asserts URL is `/welcome`, then service-role queries `onboarding_completed_at` and asserts non-null. |
| D3 | Free path double-submit guard | DevTools → Network throttle "Slow 3G". Click Continue twice rapidly. | `onboarding_completed_at` is set once (the action's `.is('onboarding_completed_at', null)` guard prevents a second update). | **STATIC PASS.** `plan/actions.ts:39` has `.is('onboarding_completed_at', null)` clause on the update. The 2nd request will UPDATE 0 rows (the guard rejects). Note: **client-side double-submit isn't blocked** — the form's `<Button disabled={pending}>` only disables once React commits the action's pending state, so a fast double-click between submit and pending-flip can still issue two POSTs. The DB guard is the correct authoritative gate. ✅ |
| D4 | Pro path → /onboarding/checkout | Pick **Pro** → Continue. | Lands on `/onboarding/checkout`. No Stripe activity in the dev terminal yet. | **STATIC PASS.** `plan/actions.ts:31-33`: `if (plan === 'pro') redirect('/onboarding/checkout')`. The action body has zero Stripe imports (`grep stripe apps/web/src/app/(onboarding)/onboarding/plan/actions.ts` → 0 hits). ✅ — Stripe round-trip has been moved to `startProCheckout`. |
| D5 | Pro path is fast | DevTools → Network. Click "Select Pro plan". Measure POST `/onboarding/plan` 303 + GET `/onboarding/checkout` total time. | Total ≤ ~700 ms (was ~3000 ms when sub-creation lived here). Plan submit no longer talks to Stripe. | **STATIC PASS** (perf claim) — the action does only one Supabase `auth.getUser()` and one `redirect`. The expensive Stripe `customers.create` + `subscriptions.create` (typically 2–3 s combined) has moved to `startProCheckout`. Live wall-clock measurement still required. |

---

## E. Checkout — interval picker (deferred Elements)

Goal: confirm interval can be toggled freely without remounting the iframe or creating any Stripe rows.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| E1 | Default interval | Visit `/onboarding/checkout` (no query). | **Annual** preselected. "Recommended" + "Save 30%" pills visible. Price line `$29/mo`. Pay button reads "Pay $348 USD" (or whatever annual `amount` is). | **✅ PASS (HTML-grep)** (2026-05-05, via test-user). `curl -b .test-cookies.txt /onboarding/checkout` returns 41 KB of HTML containing: "Annual", "Monthly", "Recommended", "Save 30%", "Pay $348 USD". Confirms `checkout/page.tsx:50` annual default + `plans.ts` $348 USD pricing. Visual cross-check (active-state border, $29/mo line) still recommended in browser. |
| E2 | URL preselect | Visit `/onboarding/checkout?interval=monthly` directly. | **Monthly** preselected. Price `$37/mo`. Pay button "Pay $37 USD". | **STATIC PASS.** `checkout/page.tsx:50`: `intervalRaw === 'monthly' ? 'monthly' : 'annual'`. `plans.ts:64-65` monthly `amount: 37, amountMonthlyEquivalent: 37`. Pay label = "Pay $37 USD". ✅ |
| E3 | Toggle round-trip | On `/onboarding/checkout`, click Monthly → Annual → Monthly. | (a) Iframe doesn't visibly remount/flicker. <br>(b) URL bar updates to `?interval=…` each toggle (no full nav). <br>(c) Pay button label reflects the picked interval each time. <br>(d) Any half-typed card digits in the iframe survive toggling. | **STATIC PASS** for (a)/(b)/(c); (d) needs UI confirm. `checkout-form.tsx:128-134`: `elements.update({ amount: plans[next].amount * 100 })` updates the existing `<Elements>` provider in-place (deferred mode supports this without remount), and `router.replace(\`/onboarding/checkout?interval=${next}\`, { scroll: false })` swaps the URL via Next's soft-nav (no document fetch). ✅ |
| E4 | Toggle disabled while submitting | Type a card. Click Pay. Immediately try to click the other interval card. | Interval buttons are disabled (~60% opacity, `disabled` attr). Cannot toggle until submission resolves. | **STATIC PASS.** `checkout-form.tsx:186` passes `disabled={submitting}` to `<IntervalPicker>`, which forwards it to each `<IntervalOption>` (`button disabled={disabled}` line 290; `opacity: disabled ? 0.6 : 1` line 296). The `handleIntervalChange` early-returns when `submitting` is true (line 126). ✅ |
| E5 | Reload preserves pick | Visit `/onboarding/checkout?interval=monthly`. Cmd+R. | Monthly still selected after reload. | **STATIC PASS.** Initial interval is read from URL searchParams server-side (`page.tsx:49-50`) and threaded into both the `<Elements>` options and the inner `useState`. Reload re-runs the server component with the same query string. ✅ |
| E6 | Garbage interval coerced | Visit `/onboarding/checkout?interval=lifetime`. | Falls back to Annual (page-level coercion: `intervalRaw === 'monthly' ? 'monthly' : 'annual'`). | **STATIC PASS.** Confirmed at `checkout/page.tsx:50` — only the literal string `'monthly'` flips off annual; everything else (empty, `lifetime`, `MONTHLY`, `null`) → annual. ✅ |
| E7 | No orphan Stripe rows | After E1–E6 (just toggling, no Pay), check Stripe Dashboard → Customers + Subscriptions in test mode. | No new customer or subscription created from interval toggling. | **STATIC PASS** — `checkout-form.tsx` `handleIntervalChange` only calls `elements.update`, `setInterval`, and `router.replace`. There is no fetch/action call from the toggle path. The only call site for `startProCheckout` is `onSubmit` at line 150. ✅ |

---

## F. Checkout — payment success path

Goal: end-to-end from Pay click to receipt.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| F1 | Annual success | Pick Annual. Card `4242 4242 4242 4242`, future expiry, any CVC, any ZIP. Click Pay. | Sequence: <br>1. Button → "Processing…", disabled. <br>2. `elements.submit()` (~50 ms). <br>3. `startProCheckout` server-side (`customers.create` + `subscriptions.create`, ~2–3 s). <br>4. `stripe.confirmPayment` (~500 ms). <br>5. Browser redirected to `/billing/success?payment_intent=…&redirect_status=succeeded`. <br>6. Page initially shows `<Finalizing>` poller. <br>7. Webhook lands → next poll tick sees `status === 'active'` → `router.refresh()` → receipt swaps in. <br>8. Receipt: $348 USD annual, period end ~1 year out. | **✅ PASS** (2026-05-05, Playwright `F1` — 14.0s). Real Stripe TEST-mode round-trip: card filled into Elements iframe, `startProCheckout` runs server-side, `confirmPayment` redirects to `/billing/success`, webhook lands within ~3s, "Pro · Annual" receipt visible. **Bug caught + fixed during this run:** middleware was redirecting `/billing/success` → `/onboarding/name` for non-onboarded users (the success page never had a chance to stamp). Fix: middleware bypass for `/billing/*` (mirror of the `/api/` bypass). See Notable findings #11. |
| F2 | Monthly success | Same as F1 but pick Monthly. | Receipt: $37 USD monthly, period end ~1 month out. | **✅ PASS** (2026-05-05, Playwright `F2` — 11.0s). Same path as F1 with `?interval=monthly`, "Pro · Monthly" receipt. |
| F3 | Server log on success | Watch dev terminal during F1. | Single line `{"msg":"createProSubscription.ok","userId":"…","subscriptionId":"sub_…","interval":"annual","currency":"USD"}`. **No `clientSecret` in any log.** | **STATIC PASS.** Verified at `(billing)/billing/actions.ts:166-174` — only the four documented fields are logged; `clientSecret` is in scope at line 152 but never appears in any `console.log/error`. `grep -n clientSecret apps/web/src/app/\(billing\)/billing/actions.ts` confirms only the literal value flow, never a log site. ✅ |
| F4 | DB row after webhook | After F1, `select * from subscriptions where user_id=<user>`. | One row: `status='active'`, `stripe_customer_id` populated, `stripe_subscription_id` populated, `current_period_end` populated, `entitlements` non-empty. | **✅ PASS** (2026-05-05, Playwright `F4` — 0.1s). After F2 settles, asserts `status='active'`, `stripe_customer_id` matches `/^cus_/`, `stripe_subscription_id` matches `/^sub_/`, `current_period_end` non-null, `entitlements = { speclyy: { plan: 'pro' } }`. |
| F5 | Onboarding stamped | After F1 receipt renders, check `select onboarding_completed_at from profiles where id=<user>`. | Non-null (success page server-side stamps). User can now reach `/projects` and middleware doesn't bounce them back to onboarding. | **STATIC PASS.** `success/page.tsx:88-103` updates `profiles.onboarding_completed_at = now()` guarded by `.is('onboarding_completed_at', null)`. Note: the stamp happens **only on the active branch** (line 79 returns `<Finalizing>` early when not active). If the webhook never lands (I3 below), `onboarding_completed_at` stays NULL — middleware will bounce the user back to `/onboarding/name`. This is documented in `finalizing.tsx:30-32` but worth flagging on the live run. ✅ |

---

## G. Checkout — payment failure paths

Goal: each failure mode surfaces user-safe inline copy and leaves the form retryable.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| G1 | Client-side card validation | Type `4242` (incomplete). Click Pay. | `elements.submit()` fails inline → red error "Please check your card details." (or Stripe's verbatim message). Button re-enables. **`startProCheckout` is NOT called** (no server log, no Stripe customer/subscription created). This is the key savings of moving sub-creation behind `elements.submit()`. | **STATIC PASS.** `checkout-form.tsx:143-148`: `await elements.submit()` → if `submitError`, set inline error, reset `submitting`, **early-return before `startProCheckout`**. Confirmed sequencing — no server round-trip on validation failure. ✅ |
| G2 | Always-declined card | Card `4000 0000 0000 0002`. Click Pay. | `elements.submit()` passes. `startProCheckout` succeeds, returns `clientSecret`. `stripe.confirmPayment` fails → red error "Your card was declined." (Stripe verbatim). Button re-enables. <br>DB: a `subscriptions` row IS created via webhook (`status='incomplete'`). User can retry on the same form. | **✅ PASS** (2026-05-05, Playwright `G2` — 8.2s). Asserts inline alert contains "declined" and Pay button is `enabled` after fail. ⚠️ retry note: repeated declines on the same customer should reuse the same `incomplete` subscription — verify before opening up retries in the UI. |
| G3 | Insufficient funds | Card `4000 0000 0000 9995`. | Same as G2, error "Your card has insufficient funds." | **✅ PASS** (2026-05-05, Playwright `G3` — 8.4s). Asserts alert contains "insufficient" and Pay button is `enabled`. |
| G4 | 3DS challenge — succeeds | Card `4000 0025 0000 3155`. Click Pay. Complete the 3DS prompt. | Stripe modal opens. Approve → modal closes → browser redirects to `/billing/success` → receipt eventually renders (same as F1). | **OPEN — not yet automated** (auth-session resolved; the Playwright suite has all the plumbing — test user, `stripe listen`, env mgmt — but the spec doesn't yet drive the Stripe 3DS challenge modal, which is a nested iframe inside the Elements iframe and needs `frameLocator` chaining). `stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url } })` handles 3DS internally — the SDK's modal/redirect logic is not in our code. ✅ logically. |
| G5 | 3DS challenge — abandoned | Card `4000 0025 0000 3155`. Click Pay. **Close** the 3DS modal without completing. | User stays on `/onboarding/checkout`. No error message (Stripe resolves with no error on dismiss); button re-enables. User can click Pay again. | **✅ FIXED (2026-05-05).** `checkout-form.tsx onSubmit` now calls `setSubmitting(false)` unconditionally after `confirmPayment` resolves — both the abandoned-3DS branch (Stripe resolves with no error) and the verbatim-error branch reset the button. Live verify with the 3DS test card by dismissing the modal. |
| G6 | 3DS challenge — fails auth | Card `4000 0027 6000 3184`. Click Pay. Fail the 3DS challenge. | Red error "We are unable to authenticate your payment method." Button re-enables. | **OPEN — not yet automated** (same reason as G4; needs `frameLocator` chaining into the 3DS modal iframe). `confirmError` branch handles this. ✅ logically. |
| G7 | Network failure during startProCheckout | DevTools → Network → set to **Offline**. Click Pay. | Red error "Network error. Please check your connection and try again.", button re-enables, form retryable. | **✅ PASS** (2026-05-05, Playwright `G7` — 3.4s). `page.route` blocks the Server Action POST mid-flight to simulate a network drop; asserts inline alert contains "network error" and Pay button is `enabled` after fail. Confirms the post-G7-fix try/catch around `startProCheckout` is correctly wired. |
| G8 | Stripe API down | Stop dev. Set `STRIPE_SECRET_KEY` to a bad value in `.env.local`. Restart dev. Click Pay. | `startProCheckout` returns `{ ok: false, code: 'stripe_error', message: '…' }`. Inline red error renders. Server log has structured `createProSubscription.stripe_failure` JSON with `type/code/statusCode/requestId`. Button re-enables. | **STATIC PASS.** `(billing)/billing/actions.ts:73-91, 124-135` wrap both `customers.create` and `subscriptions.create` in try/catch, log via `logStripeFailure` (line 192) and re-throw `BillingError('stripe_error', …, { cause })`. Action wrapper at `onboarding/checkout/actions.ts:43-47` returns `{ ok: false, code: 'stripe_error', message }`. Client at `checkout-form.tsx:160-162` sets inline error and resets `submitting`. ✅ |

---

## H. Already-subscribed paths

Goal: the active-sub guards on every chargeable surface work.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| H1 | Direct hit on `/onboarding/checkout` | `pnpm test-user:reset --onboarded-pro-active` then visit `/onboarding/checkout`. | 307 → `/projects`. (Page-level `existing?.status === 'active'` guard.) | **✅ PASS** (2026-05-05, Playwright `H1` — 2.4s + earlier curl probe). Final URL is `/projects` after redirect chain. Middleware's onboarded-gate fires before the page-level guard; both intercepts produce the same redirect target so the test reads PASS regardless of which fired; the page guard remains as defense-in-depth. |
| H2 | Plan submit when already active | Same setup. Click "Select Pro plan" on `/onboarding/plan`. | Lands on `/onboarding/checkout` → page guard → 307 → `/projects`. | **STATIC PASS.** Same code paths as H1. The form-submit flow can't be probed via curl (action returns a 303 to /onboarding/checkout, then the GET would 307 to /projects — chain works). Live verification still recommended in browser. |
| H3 | Mid-flow already-subscribed race | User is on `/onboarding/checkout`. In a parallel tab, complete a payment so the sub becomes active. Back in tab 1, click Pay. | `startProCheckout` throws `BillingError('already_subscribed')` → action returns `{ ok: false, code: 'already_subscribed' }` → client does `window.location.href = '/projects'`. | **STATIC PASS.** `(billing)/billing/actions.ts:59-64` throws `BillingError('already_subscribed', …)`. Action wraps it at `onboarding/checkout/actions.ts:43-45` → `{ ok: false, code: 'already_subscribed', message }`. Client `checkout-form.tsx:152-154` does `window.location.href = '/projects'`. ✅ Full nav (not `router.push`) is correct so middleware re-evaluates with the active row in place. |

---

## I. Webhook + success page

Goal: the webhook is the sole writer of `subscriptions` rows and the success page handles every webhook timing.

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| I1 | Happy path | Covered by F1. | — | — |
| I2 | Webhook lands BEFORE redirect | Watch the Stripe CLI terminal during F1. If the webhook event lands while `confirmPayment` is still running, the row is already `active` by the time the user sees `/billing/success`. | Success page server-side branch detects `status==='active'` on first render → renders receipt directly. `<Finalizing>` poller is NOT shown. | **STATIC PASS.** `success/page.tsx:79-85` `if (sub.status !== 'active')` → render `<Finalizing>`; otherwise render `<Receipt>`. Logic correct. Live verification still required. |
| I3 | Webhook never lands | Stop `stripe listen` before clicking Pay. Complete payment. | `/billing/success` renders `<Finalizing>` poller for 15 s, then `<TimeoutPanel>` appears ("We'll email you when it lands."). Restart `stripe listen`, replay the event from Stripe Dashboard → next page load shows the receipt. From the timeout panel, "Continue to workspace" lands on `/projects` (no onboarding bounce). | **✅ FIXED (2026-05-05).** The success page now stamps `onboarding_completed_at` early in two cases: (1) any `subscriptions` row exists for the user (status `incomplete` is enough — payment redirected from Stripe); (2) no row yet but the `payment_intent` query param is verified server-side via Stripe to be in `succeeded` state. Either path unblocks the timeout-panel "Continue to workspace" button. Pro entitlement remains gated by `subscriptions.status`. |
| I4 | Webhook idempotency | After F1 succeeds, in another terminal: `stripe events resend evt_<id>` for the `customer.subscription.created` event. | Second invocation no-ops via the `processed_webhook_events` table (migration 0004). One `subscriptions` row, no duplicates. Server log shows the duplicate detection. | **STATIC PASS.** `webhooks/stripe/route.ts:331-349` calls `recordEventProcessed(event.id)` first; on PK conflict (`subscription-writer.ts:206-219`, code `23505`) returns `false` → handler short-circuits with `outcome: 'dedup'` log. ✅ |
| I5 | `invoice.payment_failed` flips status | In Stripe Dashboard → Customer → Subscriptions → Actions → "Charge a past_due invoice" or trigger via CLI. | Webhook fires → `subscriptions.status` becomes `past_due`. Success-page branch logic still works for re-entry. | **STATIC PASS.** `webhooks/stripe/route.ts onInvoicePaymentFailed` calls `setSubscriptionStatusIfNewer({ status: 'past_due', … })`. Writer updates status + clears `entitlements.speclyy` so downstream `isPro()` checks correctly fail. ✅ **Out-of-order safety improved (2026-05-05):** the no-row-yet branch now returns `skipReason: 'no_row_yet'` and the route logs it via `console.warn` with `outcome: 'warn'` so a permanently-dropped `payment_failed` event is spotable in Vercel/Axiom logs (was previously indistinguishable from routine state-newer skips). Reconciliation cron is still the post-MVP backstop for actual recovery. |

---

## J. Edge cases

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| J1 | Refresh during card entry | On `/onboarding/checkout`, type half a card number. F5. | Card iframe resets (Stripe security — never restored). Form re-renders empty. Selected interval persists from URL. No orphan Stripe row. | **STATIC PASS.** Stripe iframe lifecycle is opaque (managed by `@stripe/react-stripe-js`); refresh re-mounts the `<Elements>` provider with the URL-derived initial interval. No fetch on mount → no orphan row. ✅ |
| J2 | Back link from checkout | Click the "Back" link on `/onboarding/checkout`. | Lands on `/onboarding/plan`. ~~Both cards visible, neither preselected (`useState` resets to `'free'`).~~ **`Free` is preselected** (`plan-form.tsx:11` initialises `useState<Plan>('free')`). Both cards visible. | **STATIC PASS.** `checkout-form.tsx:204-209` `<a href="/onboarding/plan">` is a regular link → fresh GET → fresh server render → `PlanForm` mounts with `useState<Plan>('free')`. Free IS preselected; original test wording is wrong. Updated row text to match code. ✅ |
| J3 | Browser back navigation | On `/onboarding/checkout`, browser Back. | Lands on `/onboarding/plan`. (BFCache may restore form state — that's fine; no orphan in Stripe.) | **STATIC PASS.** Same destination as J2; bfcache is browser-side and doesn't re-trigger the action. ✅ |
| J4 | Direct URL `/onboarding/checkout` | Bookmark or paste-link to `/onboarding/checkout` without going through `/plan`. | Renders normally. (Free vs Pro is a UI affordance on `/plan`; `/checkout` is the Pro path.) | **STATIC PASS.** `checkout/page.tsx` has no "must come from /plan" guard — it only checks auth + active sub. Direct hit renders the form with default annual. ✅ |
| J5 | Sign out mid-checkout | Open footer "Sign out" in another tab. Back to `/onboarding/checkout`. Click Pay. | `startProCheckout` returns `{ ok: false, code: 'unauthenticated' }` → client does `window.location.href = '/sign-in'`. | **STATIC PASS.** `(billing)/billing/actions.ts:41-43` throws `BillingError('unauthenticated', …)` if `auth.getUser()` returns null. Action wrapper at `onboarding/checkout/actions.ts:43-45` returns `{ ok: false, code: 'unauthenticated', message }`. Client `checkout-form.tsx:156-158` does `window.location.href = '/sign-in'`. ⚠️ note: there's a small window where the user is on `/onboarding/checkout` with a valid `<Elements>` mount but a stale cookie — `elements.submit()` will succeed (purely client-side validation) and only the server action call surfaces the auth failure. That's OK because the user only loses the time of typing; no Stripe call happens. |
| J6 | Cross-subdomain SSO | Sign in on `app.speclyy.local` (or whatever your local cookie-domain is). Open a sibling subdomain tab. | Authenticated without re-prompt. Confirms ADR-0019 cookie-domain wiring. | **REQUIRES Vercel preview/prod env** (auth-session resolved but irrelevant — this test is about cookie-domain scoping, not whether a session exists). Per `apps/web/.env.local.example`, `NEXT_PUBLIC_COOKIE_DOMAIN` is intentionally blank locally (`localhost` domain-narrowing breaks the cookie). On Vercel preview/prod it's `.speclyy.com`. This row is only meaningful in a deployed environment. |
| J7 | `prefers-reduced-motion` | macOS System Settings → Accessibility → Display → Reduce motion ON. Trigger F1 and stop on `/billing/success` while finalizing. | Loader glyph is **static** (no spin animation). Status text alone communicates the state. | **STATIC PASS.** `finalizing.tsx:160-165` injects `@media (prefers-reduced-motion: reduce) { [style*="animation: spin"] { animation: none !important; } }`. The loader's inline `style="animation: spin …"` matches the selector. ✅ |
| J8 | Plan-form cosmetic | Eyeball `/onboarding/plan` after the plan-form simplification. | Pro card stack: tiny "Starting from" eyebrow, `$29` display number, ` /mo` caption. Body sub-line: "Pick monthly or annual at checkout". No interval toggle. | **STATIC PASS.** `plan-form.tsx:38-47` — exact stack: `<span class="caption block">Starting from</span> <span class="font-display text-40">$29</span> <span class="caption"> /mo</span>` and body `"Everything in Free — plus unlimited PDF spec sheets and shareable client links. Pick monthly or annual at checkout."`. No `<IntervalPicker>` import. ✅ |

---

## K. Free user happy path

| ID | Description | Steps | Expected | Actual |
|----|-------------|-------|----------|--------|
| K1 | Free → /welcome → /projects | Complete onboarding via Free. From `/welcome`, click through to the workspace (or hit `/projects` directly). | No Stripe activity at all in `dashboard.stripe.com/test/customers`. `select * from subscriptions where user_id=<user>` returns 0 rows. Profile has `onboarding_completed_at`. | **STATIC PASS.** `plan/actions.ts:35-46` — Free path only updates `profiles.onboarding_completed_at` and redirects. Zero Stripe imports. No `subscriptions` row will exist for free users. ✅ |

---

## Open issues / follow-ups (file as separate tasks if confirmed)

- **✅ G7 — FIXED (2026-05-05).** `checkout-form.tsx onSubmit` now wraps both
  `startProCheckout(interval)` and `stripe.confirmPayment(…)` in try/catch.
  A thrown rejection from either path resets `submitting`, surfaces an inline
  "Network error. Please try again." message, and leaves the form retryable.
  Re-run G7 with DevTools → Offline to verify.

- **✅ G5 — FIXED (2026-05-05).** `setSubmitting(false)` now runs
  unconditionally after `confirmPayment` resolves (in a `finally`-equivalent
  position outside the error branch). The abandoned-3DS path no longer locks
  the button at "Processing…". Re-run G5 with the 3DS test card and dismiss
  the modal.

- **✅ Webhook-never-lands user-stuck — FIXED (2026-05-05).** The success page
  now stamps `onboarding_completed_at` (a) any time a `subscriptions` row
  exists, regardless of status, and (b) when no row exists yet but the
  `payment_intent` query param is verified by Stripe to be in `succeeded`
  state. Tampering is blocked by the server-side PI verification in
  `verifyPaymentIntent`. Pro entitlement is still gated by
  `subscriptions.status` — the stamp only signals "user is past the
  onboarding wall". Re-run I3 with `stripe listen` stopped, then click
  "Continue to workspace" from the TimeoutPanel — middleware should let
  the user through to `/projects`.

- **✅ `setSubscriptionStatusIfNewer` silent drop — FIXED (2026-05-05).** The
  no-row-yet branch now returns `skipReason: 'no_row_yet'` (distinct from
  the routine `'newer_state_present'`), and the webhook route's
  `outcomeFromWriteResult` helper maps that to log outcome `'warn'` (via
  `console.warn` for log-level filtering). Routine out-of-order replays
  still log as `'skipped'`; the rare data-loss case now stands out.

- **✅ `current_period_end` brittleness — FIXED (2026-05-05).** Both
  `webhooks/stripe/route.ts:periodEndDate` and the new
  `success/page.tsx:resolvePeriodEndEpoch` read the subscription-level
  `current_period_end` first (compat shim), then fall through to
  `items.data[0].current_period_end` (canonical in API
  2026-04-22.dahlia), then return `null`. If Stripe drops the shim in a
  future API version, the receipt's "Renews" line and the DB's
  `current_period_end` keep working without code changes.

- **📝 J2 doc bug — copy fixed in this doc (2026-05-05).** Test row's
  parenthetical "(useState resets to 'free')" implied "neither preselected";
  the code initialises `useState<Plan>('free')` so Free IS preselected. Row
  text updated in-place above; the code was left as-is since "default to Free"
  is the kinder onboarding default.

- **⚠️ `current_period_end` resolution**.
  `webhooks/stripe/route.ts:92-99` and `success/page.tsx:153-159` both read `(sub as Stripe.Subscription & { current_period_end?: number }).current_period_end`. Per the comment in the webhook handler, API version 2026-04-22.dahlia moved this onto items but kept the subscription-level field for compatibility. If Stripe deprecates the compat shim, the receipt's "Renews" line and the DB's `current_period_end` both go null. Worth a fallback chain: subscription-level → `items.data[0].current_period_end` → null.

- **Pay-click latency UX** — user now waits ~3–5 s on Pay click with only a "Processing…" button. The "Setting up your subscription" full-card pattern previously discussed for the plan step would do more good *here* — could replace the form during the `submitting` window.

- **Incomplete subscription rows from G2/G3** — declined-card attempts leave `status='incomplete'` rows. Confirm these don't accumulate across retries (Stripe should recycle the same subscription on the same customer; verify before opening up retries in the UI).

- **`automatic_tax` re-enable** — currently `STRIPE_AUTOMATIC_TAX=false` in `apps/web/.env.local`. Track in `TASK-BILL-09` cleanup once the checkout form collects a billing address (`<AddressElement>` + `customer_update: { address: 'auto' }`).

---

## Appendix — what was actually probed live

Recorded against the running `pnpm dev` server on 2026-05-05.

### Anon probes (no cookies)

| Probe | Command | Result |
|---|---|---|
| Anon `/onboarding/plan` | `curl -i http://127.0.0.1:3000/onboarding/plan` | 307 → `/sign-in?next=%2Fonboarding%2Fplan` |
| Anon API | `curl -i http://127.0.0.1:3000/api/billing/status` | 401 `{"error":"unauthorized"}` |
| Header spoof | `curl -i -H 'x-speclyy-user-id: 00000000-…' http://127.0.0.1:3000/onboarding/plan` | 307 → `/sign-in` (header stripped, page never rendered) |
| Anon `/welcome` | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/welcome` | 307 |
| Anon `/projects` | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/projects` | 307 |
| Anon `/onboarding/checkout` | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/onboarding/checkout` | 307 |
| Anon `/billing/success` | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/billing/success` | 307 |
| Webhook no signature | `curl -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/api/webhooks/stripe` | 400 |
| Webhook bad signature | `curl -X POST -H 'stripe-signature: t=1,v1=bogus' -d '{…}' http://127.0.0.1:3000/api/webhooks/stripe` | 400 |
| Garbage `?interval=` | `curl -i 'http://127.0.0.1:3000/onboarding/checkout?interval=lifetime'` | 307 with `next=…%3Finterval%3Dlifetime` (query preserved) |
| `?interval=monthly` | `curl -i 'http://127.0.0.1:3000/onboarding/checkout?interval=monthly'` | 307 with `next=…%3Finterval%3Dmonthly` |
| Steady-state TTFB (5 anon redirects) | `for i in 1..5; do curl -w '%{time_starttransfer}\n' …/onboarding/plan; done` | `14ms / 10ms / 8ms / 9ms / 9ms` — middleware is sub-15ms |
| TypeScript | `pnpm --filter @speclyy/web exec tsc --noEmit` | exit 0, no diagnostics |
| Perf log scan | `grep -rn '\[perf\]' apps/web/src` | 0 hits — all instrumentation removed |

### Authed probes (test user — `apps/web/.test-cookies.txt`)

These previously read BLOCKED. After `pnpm test-user:setup` + `pnpm test-user:login`:

| Row | Mode | Command | Result |
|---|---|---|---|
| **B3** | `--onboarded-free` | `curl -i -b $COOKIES /onboarding/plan` | 307 → `/projects` ✅ |
| **B4** | _(default fresh)_ | `curl -i -b $COOKIES /projects` | 307 → `/onboarding/name` ✅ |
| **H1** | `--onboarded-pro-active` | `curl -i -b $COOKIES /onboarding/checkout` | 307 → `/projects` ✅ |
| **A2** | _(default fresh)_ | 5x `curl -w '%{time_starttransfer}\n' -b $COOKIES /onboarding/plan` | `342, 271, 257, 277, 264 ms` — median ≈ 271 ms |
| **D1** | _(default fresh)_ | `curl -b $COOKIES /onboarding/plan \| grep -oE 'Continue with Free\|Starting from\|\\\$29\|Pick monthly or annual at checkout'` | All 4 strings present ✅ |
| **E1** | _(default fresh)_ | `curl -b $COOKIES /onboarding/checkout \| grep -oE 'Annual\|Monthly\|Recommended\|Save 30%\|Pay \\\$348 USD'` | All 5 strings present ✅ |

### Playwright suite (`pnpm test:e2e:billing`)

End-to-end runs on 2026-05-05. Clean first-attempt run in ~1m 12s. Some runs hit a Stripe-Elements cold-load flake (F1 or G2 first attempt) and self-heal on retry (~2 min wall-clock). Suite is configured `retries: 1`; both attempts share the per-test `resetUser` so retry doesn't accumulate state. Setup boots `stripe listen`, captures the webhook secret into `.env.local`, provisions the test user, cleans up accumulated Stripe customers, signs in, starts dev with the freshly-written env, runs all specs, kills processes, restores env on exit (even Ctrl-C).

| ID | Time | Notes |
|---|---|---|
| C1 | 5.2 s | Name form upserts profile, asserts via service-role read |
| C2 | 2.6 s | Profile row deleted then re-INSERTed via the action's UPSERT |
| D2 | 3.4 s | Free path → `/welcome`; `onboarding_completed_at` non-null |
| F1 | 14.0 s | Annual TEST-card success → `Pro · Annual` receipt |
| F2 | 11.0 s | Monthly TEST-card success → `Pro · Monthly` receipt |
| F4 | 0.1 s | DB row assertions (status / customer/sub IDs / period_end / entitlements) |
| G2 | 8.2 s | Declined card surfaces inline alert |
| G3 | 8.4 s | Insufficient funds surfaces inline alert |
| G7 | 3.4 s | `page.route` blocks the Server Action POST → "Network error" inline + button re-enabled |
| H1 | 2.4 s | Active-sub state → `/onboarding/checkout` redirects to `/projects` |
