# Onboarding & Billing — Implementation Plan

Scope: sign-in, 4-step onboarding (name → studio → market → plan), and the billing plumbing needed to exit onboarding into the app on either Free or Pro. Derived from:

- [architecture/auth.md](../architecture/auth.md), [architecture/billing.md](../architecture/billing.md)
- [screen-inventory.md](../screen-inventory.md) 
- Design: Onboarding designs

---

## Design resolution

### Sign-in — single page
One page with **Continue with Google** (primary pill) and, below an "or" divider, an inline email + **Send link** magic-link form. Copy: *"We'll email a magic link and a 6-digit code — no password."* Footer Terms/Privacy links required. OTP verify is a separate route (`/sign-in/verify`) for users who prefer the 6-digit code to clicking the link.

### Onboarding — 4 steps, 3 progress dots in steps 1–3 + plan card labelled 4 of 4
The design uses "Step X of 3" with 3 progress dots on Name/Studio/Market, then jumps to a 4-of-4 "Plan" card in the billing flow. We'll normalize to **"Step X of 4"** across all four screens so the progress indicator stays consistent. (Confirm label with design — the dot-count inconsistency is a design bug to flag.)

Step details from the design:

| # | Screen | Fields | Secondary | CTA |
|---|---|---|---|---|
| 1 | Name | `first_name`, `last_name` (both required) | Shows "Signed in as {email}" | Continue |
| 2 | Studio | `studio_name`, **`studio_size`** (Just me / 2–5 / 6–10 / 11+) | Back | Continue |
| 3 | Market | Detected city card (from Vercel IP headers) + global city search (Open-Meteo proxy at `/api/onboarding/cities`) — see [ADR-0020](../architecture/adr/0020-onboarding-market-global-cities.md) | Back | Continue |
| 4 | Plan | Free card (selected by default) + Pro card ($29/mo annual, $37 monthly) | Back | **Continue with Free** → Free Welcome screen, or select Pro → Checkout |

**Post-step 4:**
- Free path → Free Welcome screen ("Start your first project") → `/projects`
- Pro path → Stripe Elements checkout → Pro Success screen → `/projects`

### Differences from docs to resolve

1. **Studio size** field — not in [auth.md](../architecture/auth.md) schema. Add to `studios` table.
2. **Market field** — `profiles.market` CHECK constraint is dropped; column is unconstrained free text storing `"City, Region, Country"`. Onboarding picker uses IP-detected city + Open-Meteo global search per [ADR-0020](../architecture/adr/0020-onboarding-market-global-cities.md). No preset cards, no "Somewhere else" or "Nominate your city" affordances.
3. **"Skip" on studio step** — design does **not** show a Skip button, just Back/Continue. You mentioned Skip earlier — flag to confirm. If kept, add a text-link "Skip for now" next to Back.
4. **Export paywall behavior** — design allows Free users to download a **blurred/watermarked PDF** (copy: *"it'll export with a light blur watermark"*), whereas [billing.md](../architecture/billing.md) says "blurred preview shown" (no download). Design supersedes; plan updates billing.md accordingly.
5. **Market CTA copy** — design shows "Open Speclyy" on step 3, but with a plan step after, it should say "Continue".
6. **Market preset cards** — design shows four preset launch markets (LA / NY / Dallas / Calgary) + "Somewhere else" + "Nominate your city". All replaced by a global IP-detected + searchable picker per [ADR-0020](../architecture/adr/0020-onboarding-market-global-cities.md).

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
-- `market` is now unconstrained free text storing "City, Region, Country" (see ADR-0020).
-- No `market_custom` column — single column suffices since every value is free text.
```

**Subscription ownership:** recommend moving `subscriptions.user_id` → `subscriptions.studio_id` so a Pro plan covers the whole studio. Decide before issue #15; defer only if flagged as tech debt.

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
11. **Step 2 · Studio** ([onboarding/studio/page.tsx](../../apps/web/src/app/(onboarding)/onboarding/studio/page.tsx)) — add studio name + studio-size selector (4 options). Server Action upserts `studios` and links `profiles.studio_id`. Confirm whether "Skip" should exist (design doesn't show it).
12. **Step 3 · Market** ([onboarding/market/page.tsx](../../apps/web/src/app/(onboarding)/onboarding/market/page.tsx)) — IP-detected city card (Vercel headers) + global Open-Meteo search via [`/api/onboarding/cities`](../../apps/web/src/app/api/onboarding/cities/route.ts). Stores `"City, Region, Country"` in `profiles.market` (free text). CTA label **Continue**. → `/onboarding/plan`. See [ADR-0020](../architecture/adr/0020-onboarding-market-global-cities.md).
13. **Step 4 · Plan** (NEW) — Free + Pro cards per [flow6 `F6_PlanStep`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx). "Continue with Free" → `completeOnboarding` (sets `onboarding_completed_at`) → Free Welcome screen. Selecting Pro → `createCheckoutSession('annual'|'monthly')` → Stripe.

### Billing

14. **Stripe env + product seeding** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_PRO_ANNUAL`. Document setup.
15. **Checkout: embedded Stripe Elements page** per [flow6 `F6_Checkout`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx). Confirm: design shows embedded Elements (inline card form), **not** Stripe Checkout redirect. [billing.md](../architecture/billing.md) currently specifies redirect-to-Checkout — **resolve this mismatch** (recommend following design = Elements; update billing.md). Order-summary pane with annual discount callout.
16. **`POST /api/webhooks/stripe` handler** — verify signature, upsert `subscriptions` via service-role. Events: `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`.
17. **Pro Success screen** — post-checkout receipt block + "Open your workspace" → `/projects`. Complete onboarding here if not already complete.
18. **Free Welcome screen** — "Start your first project" → `/projects/new`. Shown after plan step on Free path.
19. **Export paywall modal** — design in [flow6 `F6_ExportPaywall`](../../../../Downloads/Speclyy%20Design%20System%20(1)/flows/flow6-billing.jsx). Monthly/Annual toggle, "Export blurred PDF" + "Upgrade and export" actions. Update [billing.md](../architecture/billing.md) to reflect that Free users **can** download the watermarked PDF.

### Quality gates

20. **Playwright: full onboarding — Free path** — new Google user → 4 steps → Free Welcome → `/projects`.
21. **Playwright: full onboarding — Pro path** — new user → 4 steps → select Pro → Stripe test card → Success → `/projects`. Assert `subscriptions.status = 'active'`.
22. **Schema contract test** — trigger creates `profiles` row on `auth.users` insert.
23. **RLS smoke test** — user X cannot read user-Y `profiles`/`subscriptions`/`studios`.

---

## Open questions for review

- **Studio "Skip"** — keep or drop? (design shows Back/Continue only).
- **Subscription ownership** — per-user or per-studio? Recommend per-studio now; cheaper than migrating later.
- **Studio dedupe** — if two designers type the same studio name, separate rows (v1) or invite flow (v2)? v1 = separate.
- **Checkout surface** — embedded Elements (design) vs hosted Stripe Checkout (billing.md). Picking embedded matches the design but adds PCI scope considerations via Elements; confirm.
- **Progress label** — normalize to "Step X of 4" across all four screens? (design has "of 3" on screens 1–3, "of 4" on plan).
