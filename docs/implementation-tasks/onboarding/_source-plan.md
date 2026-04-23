# Onboarding & Billing — Implementation Plan

Scope: sign-in, 4-step onboarding (name → studio → market → plan), and the billing plumbing needed to exit onboarding into the app on either Free or Pro. Derived from:

- [architecture/auth.md](../architecture/auth.md), [architecture/billing.md](../architecture/billing.md)
- [screen-inventory.md](../screen-inventory.md) §1–2
- Design: Onboarding designs

---

## Design resolution

### Sign-in — single page
One page with **Continue with Google** (primary pill) and, below an "or" divider, an inline email + **Send link** magic-link form. Copy: *"We'll email a magic link and a 6-digit code — no password."* Footer Terms/Privacy links required. OTP verify is a separate route (`/sign-in/verify`) for users who prefer the 6-digit code to clicking the link.

### Onboarding — 4 steps, "Step X of 4" everywhere
Progress label normalized to "Step X of 4" across all four screens (design shows "of 3" on 1–3, "of 4" on Plan — design bug, overridden).

Step details:

| # | Screen | Fields | Secondary | CTA |
|---|---|---|---|---|
| 1 | Name | `first_name`, `last_name` (both required) | Shows "Signed in as {email}" | Continue |
| 2 | Studio | `studio_name`, **`studio_size`** (Just me / 2–5 / 6–10 / 11+) | Back · **Skip** | Continue |
| 3 | Market | 4 preset cards (Los Angeles / New York / Dallas / Calgary) **+ "Somewhere else" free-text city/region** + "Nominate your city →" link | Back | Continue |
| 4 | Plan | Free card (selected by default) + Pro card ($29/mo annual, $37 monthly) | Back | **Continue with Free** → Free Welcome, or select Pro → Checkout |

**Skip behavior (step 2):** if the user skips, auto-create a `studios` row named `"{first_name} {last_name}"` and link `profiles.studio_id`. Keeps the invariant *every profile has a studio*, which simplifies future teammate invites.

**Post-step 4:**
- Free path → Free Welcome screen ("Start your first project") → `/projects`
- Pro path → embedded Stripe Elements checkout → Pro Success screen → `/projects`

### Decisions (confirmed)

1. **Studio size** — added to `studios` table.
2. **Market** — drop the `profiles.market` CHECK constraint and store free text. No separate `market_custom` column.
3. **Studio Skip** — keep. Auto-create studio from user's first/last name on skip.
4. **Export paywall** — **blurred preview, no download** (keep [billing.md](../architecture/billing.md) behavior; design's "download blurred PDF" is overridden).
5. **Market CTA** — "Continue" (not "Open Speclyy").
6. **Checkout** — embedded Stripe Elements (update [billing.md](../architecture/billing.md) from hosted-Checkout redirect).
7. **Subscription ownership** — **per-user**, not per-studio. Future teammate invites will each get their own subscription with a per-seat discount.
8. **Studio dedupe** — none. Duplicate studio names are allowed; two rows with the same name is fine.
9. **Progress label** — "Step X of 4" on all four screens.

---

## Schema revision (update before wiring screens)

Amendments to [auth.md §Data model](../architecture/auth.md) and [ADR-0007](../architecture/adr/0007-auth-data-model.md):

```sql
CREATE TABLE public.studios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  size       text CHECK (size IN ('solo','2_5','6_10','11_plus')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  DROP COLUMN studio_name,
  ADD  COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  DROP CONSTRAINT profiles_market_check;
-- `market` stays as free-text. Canonical values ('los_angeles','new_york','dallas','calgary')
-- come from the UI; "Somewhere else" stores whatever the user typed.
```

**Subscription ownership stays per-user** (`subscriptions.user_id`). No change to [billing.md](../architecture/billing.md) ownership model.

---

## Tasks (proposed GitHub issues)

### Foundation

1. **Provision Supabase + env wiring** — project, Google OAuth, email OTP, 90d inactivity timeout. Envs into Vercel + `.env.local.example`.
2. **DB migration: `studios` + updated `profiles` + `subscriptions` + trigger + RLS** — per schema revision above. Update [auth.md](../architecture/auth.md) §Data model and [ADR-0007](../architecture/adr/0007-auth-data-model.md) in the same PR.
3. **Supabase SSR client factories** — browser / server / middleware variants + generated DB types.
4. **`middleware.ts` auth + onboarding gates** — per [auth.md §Middleware gate chain](../architecture/auth.md). State-matrix unit tests.

### Auth surfaces

5. **`/sign-in` page** — single page, design: [flow1-onboarding.jsx `F1_SignIn`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow1-onboarding.jsx). Google button + inline magic-link input + Terms/Privacy footer. Error from `?error=` query.
6. **`/sign-in/verify` page** — 6-digit code entry, 60s resend cooldown, rate-limit copy.
7. **`/auth/callback` route** — `exchangeCodeForSession`, redirect by onboarding state.
8. **`/sign-out` server action** — revoke refresh token, clear cookies, redirect `/sign-in`.

### Onboarding screens (wire up + create the new plan step)

9. **Onboarding layout + shell** — shared logo/footer, progress component (4 dots, label "Step X of 4"), defensive `profiles` upsert on mount.
10. **Step 1 · Name** ([onboarding/name/page.tsx](../../apps/web/src/app/(onboarding)/onboarding/name/page.tsx)) — replace single field with `first_name` + `last_name`; show "Signed in as {email}" line. Server Action persists → `/onboarding/studio`.
11. **Step 2 · Studio** ([onboarding/studio/page.tsx](../../apps/web/src/app/(onboarding)/onboarding/studio/page.tsx)) — studio name + studio-size selector + **Skip** link next to Back. `saveStudio` creates a `studios` row (no dedupe) and links `profiles.studio_id`. `skipStudio` creates a studio named `"{first_name} {last_name}"` with null size and links it, then advances.
12. **Step 3 · Market** ([onboarding/market/page.tsx](../../apps/web/src/app/(onboarding)/onboarding/market/page.tsx)) — fix preset values to `los_angeles|new_york|dallas|calgary`, add "Somewhere else" card with free-text input stored verbatim in `profiles.market`. Add "Nominate your city →" link (mailto or no-op for v1). CTA label **Continue**. → `/onboarding/plan`.
13. **Step 4 · Plan** (NEW) — Free + Pro cards per [flow6 `F6_PlanStep`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx). "Continue with Free" → `completeOnboarding` (sets `onboarding_completed_at`) → Free Welcome screen. Selecting Pro → `createCheckoutSession('annual'|'monthly')` → Stripe.

### Billing

14. **Stripe env + product seeding** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_PRO_ANNUAL`. Document setup.
15. **Checkout: embedded Stripe Elements page** per [flow6 `F6_Checkout`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx). Embedded Elements (inline card form) — **update [billing.md](../architecture/billing.md) to replace hosted-Checkout redirect with Elements + PaymentIntent/SetupIntent flow**. Order-summary pane with annual discount callout.
16. **`POST /api/webhooks/stripe` handler** — verify signature, upsert `subscriptions` via service-role. Events: `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`.
17. **Pro Success screen** — post-checkout receipt block + "Open your workspace" → `/projects`. Complete onboarding here if not already complete.
18. **Free Welcome screen** — "Start your first project" → `/projects/new`. Shown after plan step on Free path.
19. **Export paywall modal** — based on [flow6 `F6_ExportPaywall`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx) but **no download on Free**: show blurred preview in-modal only. Remove "Export blurred PDF" action; keep Monthly/Annual toggle and "Upgrade and export" primary CTA. Revise design copy accordingly.

### Quality gates

20. **Playwright: full onboarding — Free path** — new Google user → 4 steps → Free Welcome → `/projects`.
21. **Playwright: full onboarding — Pro path** — new user → 4 steps → select Pro → Stripe test card → Success → `/projects`. Assert `subscriptions.status = 'active'`.
22. **Schema contract test** — trigger creates `profiles` row on `auth.users` insert.
23. **RLS smoke test** — user X cannot read user-Y `profiles`/`subscriptions`/`studios`.

---

All prior open questions resolved — see **Decisions (confirmed)** above. Ready to convert tasks 1–23 into GitHub issues.
