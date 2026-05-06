---
id: TASK-BILL-09
title: CAD pricing expansion — multi-currency Pro plan
group: billing-subscription
status: planned
estimate: 5
dependencies: [TASK-BILL-01, TASK-BILL-03, TASK-BILL-04, TASK-ONB-05, TASK-AUTH-02]
related_screens: ["2.4 Onboarding · Plan", "2.4a Onboarding · Checkout"]
related_adrs: [ADR-0017, ADR-0018]
created: 2026-04-26
---

# TASK-BILL-09 — CAD pricing expansion

## Goal

Add native **CAD** pricing for Canadian users alongside the existing USD plan, using Stripe's *one product, many prices* shape so the same architecture extends to future markets (India, UAE, etc.) without per-region forks. CAD prices are **clean local numbers** — not FX-converted USD — so the displayed price stays stable regardless of exchange-rate drift. The user's currency is **detected** (Vercel geo + `Accept-Language`) and **overridable** via a 🇨🇦/🇺🇸 toggle on the plan screen.

This task is the *first* multi-currency expansion — its job is to land the pattern (currency-keyed price resolution, currency-aware Server Action, billing-address ↔ currency validation, Stripe Tax registration), not just the two CAD prices. Future markets layer on as new keys in the same map.

## Scope

**In scope**
- **Stripe dashboard:** *(no work — CAD prices already created in [TASK-BILL-01](TASK-BILL-01-stripe-provisioning.md).)* Verify the two CAD prices on the Speclyy Pro product still exist (test + live), tagged `{ region: 'CA' }`, denominated **CA$49/mo** and **CA$468/yr** (= "$39/mo CAD billed annually" — `$39 × 12 = $468`, exact match to the USD pattern of $29 × 12 = $348). If they're missing, fall back to BILL-01 to create them; this task assumes they're already there.
- **Env vars** — *(no work — already populated in BILL-01.)* Verify `STRIPE_PRICE_ID_PRO_MONTHLY_CAD` and `STRIPE_PRICE_ID_PRO_ANNUAL_CAD` are set in `.env.local`, Vercel Preview/Development, and Vercel Production. This task is the first to **read** them; BILL-01 was the first to populate them.
- **`apps/web/src/lib/billing/plans.ts`** — restructure from `{ monthly, annual }` to currency-keyed `{ USD: { monthly, annual }, CAD: { monthly, annual } }` (full shape under "Implementation notes").
- **DB migration** — add `currency text not null default 'USD'` to `public.subscriptions` (CHECK in `('USD','CAD')`, extensible). Backfill existing rows to `'USD'`.
- **`createProSubscription` Server Action** ([TASK-BILL-03](TASK-BILL-03-create-pro-subscription-action.md)) — extend signature to `(interval, currency)`. Resolve `priceId = PLANS[currency][interval].priceId`. Pass `currency` through to the Stripe Subscription's `metadata` (`{ userId, currency }`) so the webhook handler can persist it.
- **Webhook handler** ([TASK-BILL-05](TASK-BILL-05-stripe-webhook-handler.md)) — read `subscription.metadata.currency` (or fall back to `subscription.currency.toUpperCase()` from the Stripe object) and write to `subscriptions.currency`.
- **Currency detection + override** on the plan screen ([TASK-ONB-05](../onboarding/TASK-ONB-05-step-4-plan.md)):
  - Default currency from Vercel geo header `x-vercel-ip-country` (`CA` → CAD; anything else → USD).
  - Fallback to `Accept-Language` parse if geo header absent (e.g. local dev).
  - Render a 🇺🇸 USD / 🇨🇦 CAD segmented toggle above the Pro card; flipping it re-renders the displayed price and changes which `priceId` the Server Action receives.
- **Billing-address validation** in checkout ([TASK-BILL-04](TASK-BILL-04-checkout-elements-page.md)):
  - `PaymentElement` collects billing address.
  - On `confirmPayment`, server-side double-check: if `currency === 'CAD'` then billing-address country **must** be `CA`, and vice versa for USD (allow `US` only — block `CA` from picking USD pricing too, optional, see Open questions).
  - Mismatch → inline error "Billing address must be in Canada to use CAD pricing — switch to USD or update your address."
- **Stripe Tax** — enable in dashboard, set `automatic_tax: { enabled: true }` on the Subscription create call. **Register the federal GST/HST ID in Stripe before deploy** — see "Tax compliance gate" below. Provincial registrations are *not* deploy-blocking; they're added reactively when first customers in those provinces appear (see [`../../business/stages.md`](../../business/stages.md) § Stage 2).
- **Tax compliance gate (deploy-blocking).** Decision: CAD launch ships with **federal GST/HST collection** live. Provincial tax (PST/QST/RST) is *not* required at deploy and follows the reactive playbook in [`../../business/tax-canada.md`](../../business/tax-canada.md) § "Provincial registrations".
  - **Federal GST/HST** with CRA — required before any CAD revenue is collected. Register voluntarily even if below the $30k threshold; this also enables Input Tax Credits on Speclyy's cloud spend (see [`../../business/tax-canada.md`](../../business/tax-canada.md) § "register voluntarily").
  - Paste the CRA Business Number + RT0001 GST/HST suffix into Stripe Tax → Registrations as the "Canada" entry. Stripe then computes 5% GST for AB/territories + 13–15% HST for ON/NB/NS/PE/NL automatically.
  - **Provincial PST/QST/RST: not blocking.** Until registered, BC/SK/MB/QC customers see only the 5% GST line on their invoice. That's a conservative under-collection — correctable by a future invoice + provincial registration when the first paying customer in that province appears. Stripe Tax's monitoring view + the quarterly review described in [`../../business/stages.md`](../../business/stages.md) § Stage 2 catches the trigger.
  This is non-engineering work but the **federal** filing blocks the deploy. Treat it like a database migration that has to land first; the provincial side does *not* block.
- **Help-doc page — "Changing your billing currency"** — `apps/web/src/app/(marketing)/help/billing/changing-currency/page.tsx`. Single-page article explaining: currency is set at signup based on billing address; to switch, cancel via the customer portal and re-subscribe with the new currency selected; existing invoices are not retroactively converted. Link to it from:
  - The Customer Portal entry CTA in account settings (small "Need to change currency?" link below the "Manage billing" button — see [TASK-BILL-07](TASK-BILL-07-customer-portal.md)).
  - The Pro Success screen ([TASK-BILL-06](TASK-BILL-06-pro-success-screen.md)) — small footnote-style link.
- **Provisioning doc update** ([`../../architecture/operations/stripe-provisioning.md`](../../architecture/operations/stripe-provisioning.md), introduced in TASK-BILL-01) — add the CAD provisioning steps, Stripe Tax setup section, and the **tax registration runbook** (which forms to file with CRA / Revenu Québec / provincial agencies, expected turnaround, where to paste the IDs in Stripe).
- **`architecture/billing.md`** — replace the single-currency Plans table with a currency-aware version; add a "Multi-currency" subsection documenting the resolution flow and the VPN-arbitrage note (deferred mitigation until India).

**Out of scope**
- **India / UAE / other regions** — separate tasks. This task is the *pattern carrier*; subsequent currencies become 1-point follow-ups (add prices in dashboard, add a key to `PLANS`).
- **Card-issuer (BIN) country validation** for VPN-arbitrage prevention. USD↔CAD spread is small (~30%) — not worth the complexity. Revisit when introducing INR/AED. Tracked in [`../../architecture/billing.md`](../../architecture/billing.md) § Open questions.
- **Plan switching between currencies post-subscription** — out for MVP. A user who needs to change currency cancels in the portal and re-subscribes (the help-doc page covers this flow). Same pattern as monthly↔annual.
- **The act of filing the CRA federal GST/HST registration.** That paperwork is the business owner's job — engineering owns the Stripe Tax wiring. **Deploying without the CRA GST/HST registration filed and entered into Stripe is forbidden** — see the compliance gate under "Implementation notes".
- **Provincial tax registrations (BC PST / SK PST / MB RST / QST).** Out of scope for this task — they're added reactively when first customers in those provinces appear, per [`../../business/stages.md`](../../business/stages.md) § Stage 2. Deploying without them is *not* a compliance failure; it's the documented Stage-1 posture.

## Acceptance criteria

```gherkin
Scenario: Canadian visitor sees CAD by default
  Given an unauthenticated visitor with x-vercel-ip-country = "CA"
  When they reach /onboarding/plan
  Then the Pro card shows "$49/mo CAD" (monthly) and "$39/mo CAD billed annually" (annual)
  And the currency toggle reads "🇨🇦 CAD" as selected

Scenario: US visitor sees USD by default
  Given an unauthenticated visitor with x-vercel-ip-country = "US"
  When they reach /onboarding/plan
  Then the Pro card shows "$37/mo USD" and "$29/mo USD billed annually"
  And the currency toggle reads "🇺🇸 USD" as selected

Scenario: User overrides detected currency
  Given a visitor sees "$49/mo CAD" by default
  When they click the "🇺🇸 USD" toggle
  Then the displayed price updates to "$37/mo USD"
  And selecting Pro calls createProSubscription('monthly', 'USD')

Scenario: Currency reaches the subscriptions row
  Given createProSubscription('annual', 'CAD') succeeded
  And the customer.subscription.created webhook fired
  When the row is inserted in public.subscriptions
  Then subscriptions.currency = 'CAD'

Scenario: Billing-address mismatch is rejected
  Given the user selected CAD pricing
  When PaymentElement submits a billing address with country = 'US'
  Then confirmPayment is blocked server-side before money moves
  And the inline error reads "Billing address must be in Canada to use CAD pricing"
  And no Stripe charge is attempted

Scenario: Existing USD subscribers are unaffected
  Given a user with subscriptions.currency = 'USD' (backfilled)
  When they open the customer portal
  Then their existing USD subscription renders normally
  And no migration prompt is shown

Scenario: Stripe Tax is applied for Canadian customers
  Given a CAD subscription with billing address in Ontario
  And Stripe Tax has the Speclyy GST/HST registration ID configured
  When the first invoice is generated
  Then automatic_tax.status = 'complete'
  And the invoice line items include HST 13%

Scenario: BC customer at deploy time sees GST only (PST deferred to Stage 2)
  Given a CAD subscription with billing address in British Columbia
  And Stripe Tax has the federal GST/HST registration configured
  And Stripe Tax does NOT yet have BC PST registered (Stage 2 trigger)
  When the first invoice is generated
  Then the invoice line items include GST 5%
  And no PST line is added (under-collection by design — registration follows the first BC customer)

Scenario: Permissive USD billing address
  Given a Canadian visitor toggles to USD pricing
  When PaymentElement submits a billing address with country = 'CA'
  Then confirmPayment proceeds
  And the resulting subscription has currency = 'USD'

Scenario: Help-doc is reachable from portal
  Given an active Pro subscriber on the account-settings page
  When they look at the "Manage billing" section
  Then a "Need to change currency?" link is visible
  And clicking it navigates to /help/billing/changing-currency
  And the page renders the cancel-and-re-subscribe instructions

Scenario: USD subscription has no tax line (until US states are configured)
  Given a USD subscription with billing address in California
  When the first invoice is generated
  Then automatic_tax is enabled but no tax line is added
  (Stripe Tax requires explicit US-state nexus registration; not in scope here)
```

## Architecture references

- [`../../architecture/billing.md`](../../architecture/billing.md) § "Subscription model" — single-currency Plans table; this task replaces it with the currency-keyed version.
- [`../../architecture/billing.md`](../../architecture/billing.md) § "Open questions" → "Stripe Tax" — moved to Implemented (for Canada) by this task.
- [ADR-0018 — Payment surface](../../architecture/adr/0018-payment-surface.md) — embedded Elements still applies; only the price resolution changes.
- [ADR-0017 — Subscription ownership](../../architecture/adr/0017-subscription-ownership.md) — `metadata.userId` attribution; this task adds `metadata.currency` alongside.
- [TASK-BILL-01](TASK-BILL-01-stripe-provisioning.md) — original USD-only provisioning; this task layers CAD on top.

## Implementation notes

### Stripe dashboard

The CAD prices were created in [TASK-BILL-01](TASK-BILL-01-stripe-provisioning.md). This task does **not** require a Stripe-dashboard session — verify, don't create:

- Confirm Speclyy Pro has all four prices (USD monthly $37, USD annual $348, CAD monthly CA$49, CAD annual CA$468) in both test and live mode.
- Confirm the two CAD prices have metadata `{ region: 'CA' }`.
- Confirm Customer Portal still has plan switching disabled — adding prices to a portal-enabled product *can* silently re-enable it, so re-verify here even though we didn't add prices in this task.
- If any of the above is missing or wrong, BILL-01 was incomplete — fix there before continuing.

### `apps/web/src/lib/billing/plans.ts`

```ts
export type Currency = 'USD' | 'CAD'
export type Interval = 'monthly' | 'annual'

export const PLANS = {
  USD: {
    monthly: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY_USD!,
      amount: 37,
      currency: 'USD' as const,
      label: '$37/mo USD',
      annualEquivalentLabel: null,
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_ANNUAL_USD!,
      amount: 348,
      currency: 'USD' as const,
      label: '$348/yr USD',
      annualEquivalentLabel: '$29/mo USD billed annually',
    },
  },
  CAD: {
    monthly: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY_CAD!,
      amount: 49,
      currency: 'CAD' as const,
      label: '$49/mo CAD',
      annualEquivalentLabel: null,
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_ANNUAL_CAD!,
      amount: 468,
      currency: 'CAD' as const,
      label: '$468/yr CAD',
      annualEquivalentLabel: '$39/mo CAD billed annually',
    },
  },
} as const satisfies Record<Currency, Record<Interval, unknown>>

export function resolvePrice(currency: Currency, interval: Interval) {
  return PLANS[currency][interval]
}
```

### DB migration

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN currency text NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'CAD'));

-- Future expansions (India, UAE) extend the CHECK constraint via a follow-up migration.
```

Backfill: any existing rows default to `'USD'` — correct, since CAD didn't exist before this task ships.

### Currency detection (Server Component for the plan screen)

```ts
// apps/web/src/lib/billing/detect-currency.ts
import { headers } from 'next/headers'

export function detectDefaultCurrency(): Currency {
  const h = headers()
  const country = h.get('x-vercel-ip-country')?.toUpperCase()
  if (country === 'CA') return 'CAD'
  if (country === 'US') return 'USD'

  // Fallback for local dev / non-Vercel environments.
  const acceptLang = h.get('accept-language') ?? ''
  if (/^en-CA\b|;q=.*\ben-CA\b/i.test(acceptLang)) return 'CAD'
  return 'USD'
}
```

The plan-screen RSC reads this once for the initial render. The toggle on the client side flips it without re-fetching.

### Server Action signature change

```ts
// apps/web/src/app/(billing)/billing/actions.ts
export async function createProSubscription(
  interval: Interval,
  currency: Currency,
) {
  // …existing user / customer lookup…

  const { priceId } = resolvePrice(currency, interval)

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    automatic_tax: { enabled: true },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId, currency },          // <— added
  })
  // …
}
```

The `currency` param is passed through `metadata` so the webhook can persist it deterministically (Stripe also exposes `subscription.currency`, but the `metadata` source is the user's *explicit choice*, which is what we want to store).

### Plan-screen UI ([TASK-ONB-05](../onboarding/TASK-ONB-05-step-4-plan.md))

- Default currency from `detectDefaultCurrency()` server-side; pass to the Client Component as a prop.
- Render a segmented control above the Pro card:
  ```
  [ 🇺🇸 USD ] [ 🇨🇦 CAD ]
  ```
  Width-stable, keyboard-navigable (`role="radiogroup"`).
- Flipping the toggle:
  - Updates the displayed price (`PLANS[currency][interval].label`).
  - Updates the `currency` field in the form so the Server Action receives the right value.
- Persist the chosen currency in `sessionStorage` so reload doesn't reset the toggle.
- Do **not** persist across logouts — the next visitor on the same browser should re-detect.

### Billing-address validation ([TASK-BILL-04](TASK-BILL-04-checkout-elements-page.md))

- `PaymentElement` already collects billing address (default behavior). Configure the `addressElement` to require country.
- After `confirmPayment` returns, **before** treating it as success, server-side: read the PaymentMethod's billing details, compare `address.country` to the subscription's currency:
  - **`currency === 'CAD'` → require `country === 'CA'`.** This is the discount-eligibility gate.
  - **`currency === 'USD'` → permissive.** Any country accepted (incl. Canada-paying-USD). Decision rationale: only two currencies, prices are close (~30% spread), USD is the international fallback for non-detected countries. Revisit only when introducing markets with significant PPP discounts (INR, etc.).
- Mismatch → call `stripe.subscriptions.cancel(id)` to revoke the incomplete subscription, return a typed error to the UI, do not redirect to `/billing/success`.

### Stripe Tax setup

- Dashboard → Tax → Enable. Set Speclyy's tax-collection origin (Canada).
- Register the **CRA federal GST/HST ID** in Stripe Tax's Registrations panel as the "Canada" entry. This is the single deploy-blocking registration.
- Provincial registrations (BC PST, SK PST, MB RST, QST) are *not* added at this task — they're added later, on first paying customer in that province. See [`../../business/stages.md`](../../business/stages.md) § Stage 2 for the reactive playbook.
- Set `automatic_tax: { enabled: true }` on Subscription create (shown above).
- Verify a test invoice for an Ontario billing address shows HST 13%; for BC, GST 5% only (PST is *not* collected until BC PST is registered, which is post-launch).
- Stripe handles invoice rendering with tax line items automatically.

### Webhook handler change ([TASK-BILL-05](TASK-BILL-05-stripe-webhook-handler.md))

- On `customer.subscription.created` and `.updated`:
  ```ts
  const currency =
    (event.data.object.metadata?.currency as Currency | undefined) ??
    event.data.object.currency.toUpperCase() as Currency
  ```
- Include `currency` in the upsert.

## Review notes

- **No Stripe-dashboard work.** All four prices were created in BILL-01. Reviewer confirms there's no diff in Products & Prices coming from this task — only `plans.ts`, the Server Action, the DB migration, the UI, and the help-doc.
- **No env-var rename.** BILL-01 already adopted the `_USD` suffix and populated `_CAD` placeholders. This task simply starts *reading* `STRIPE_PRICE_ID_PRO_MONTHLY_CAD` and `STRIPE_PRICE_ID_PRO_ANNUAL_CAD`. If a Vercel-side `_CAD` var is missing or empty, the deploy of this task will crash on `plans.ts`'s `process.env.STRIPE_PRICE_ID_PRO_MONTHLY_CAD!` non-null assertion — verify env vars are populated in **all three scopes** (Development, Preview, Production) before merging.
- **Currency in `metadata`, not just `subscription.currency`.** Stripe's own `currency` field reflects what the *price* is denominated in; we store `metadata.currency` so we can audit user intent independently. Both should agree — assert it in the webhook handler.
- **`automatic_tax: true` requires customer with a tax-determinable address.** The first time the Subscription is created (incomplete state, no PaymentMethod yet), the customer has no address — Stripe Tax will defer until invoice finalization. Confirm tax line appears on the *first paid invoice*, not at subscription create.
- **Toggle persistence.** `sessionStorage` only — never write currency preference to a cookie that survives sign-out, since the next user on the same machine should re-detect from their geo.
- **Migration timing.** The `currency` column migration must land *before* the webhook handler tries to write `currency`, or the handler will crash on existing-installation rows. Run migration first, deploy code second.
- **Billing-address mismatch UX.** After a mismatch, the user is sitting on `/onboarding/checkout` with an inline error. The cookie has been consumed (single-use), so they can't retry without going back to `/onboarding/plan`. Provide an explicit **"Back to plan selection"** link in the error block so they aren't stuck.
- **CRA federal GST/HST registration is deploy-blocking; provincial is not.** Decision: file the CRA GST/HST registration and enter the BN+RT0001 ID into Stripe Tax **before** the deploy that enables CAD pricing. Reviewer confirms: (a) Stripe Tax → Registrations panel shows the live "Canada" entry (not test/empty), (b) a test invoice for an Ontario billing address shows HST 13% in the line items, (c) the PR description lists the registration number. Do not approve the deploy if any of these are missing. **Provincial PST/QST/RST is *not* deploy-blocking** — it follows the reactive Stage-2 playbook in [`../../business/stages.md`](../../business/stages.md). Don't gate this task on provincial filings.
- **Help-doc copy is locked at deploy.** The link from account settings will 404 if the help page isn't shipped in the same deploy. Confirm the route exists and renders before the portal-CTA changes ship.

## Test plan

- **Unit:** `resolvePrice('CAD', 'annual')` returns the CAD annual config; `resolvePrice('USD', 'monthly')` returns USD monthly. Type-narrowing prevents invalid combinations at compile time.
- **Unit:** `detectDefaultCurrency()` with mocked headers — `x-vercel-ip-country: CA` → CAD, `US` → USD, no header + `Accept-Language: en-CA,en;q=0.9` → CAD, no header + `en-US` → USD.
- **Unit:** `createProSubscription('annual', 'CAD')` calls `stripe.subscriptions.create` with the CAD annual price ID and `metadata.currency = 'CAD'`.
- **Unit:** webhook handler upserts `subscriptions.currency` from event metadata.
- **Manual:** load `/onboarding/plan` from a Canadian VPN (or set `x-vercel-ip-country: CA` via a preview deploy header) — confirm CAD shows by default, prices display correctly.
- **Manual:** flip the toggle USD↔CAD on the plan screen — prices update without page reload, Server Action submits the new currency.
- **Manual (Stripe test mode):** complete a CAD checkout with test card `4242 4242 4242 4242` and a Canadian billing address. Confirm:
  - Stripe dashboard shows the subscription denominated in CAD with the CAD price.
  - Webhook fires, `subscriptions.currency = 'CAD'` in DB.
  - First invoice (after Stripe Tax registration) shows the appropriate tax line.
- **Manual (mismatch):** select CAD pricing, submit `PaymentElement` with a US billing address — assert the inline error fires and no charge occurs in Stripe dashboard.
- **Manual (existing USD users):** seed a `subscriptions` row with `currency = NULL` (pre-migration shape), run migration, confirm row is updated to `'USD'` via the default.
- **Manual (permissive USD):** select USD on the toggle from a Canadian context, complete checkout with a Canadian billing address — confirm the subscription is created with `currency = 'USD'` and no mismatch error.
- **Manual (BC tax — deploy-time):** test invoice for a BC billing address shows GST 5% only. PST 7% is *not* expected to appear at this stage (BC PST registration is a Stage 2 follow-up; see [`../../business/stages.md`](../../business/stages.md)).
- **Manual (help-doc):** navigate from `/account` (or wherever the portal CTA lives) to `/help/billing/changing-currency` — confirm the link is present, the page renders, and copy explains cancel-and-re-subscribe.
- **Manual (compliance dry-run):** before merging, verify Stripe Tax → Registrations panel shows live (not test) Canadian registration IDs.
- **Doc check:** the updated `docs/architecture/operations/stripe-provisioning.md` lets a second engineer reproduce the CAD setup *and* find the tax-registration runbook on a scratch Stripe account.
- **E2E coverage** ships in [TASK-TEST-04](../testing/TASK-TEST-04-billing-e2e-suite.md) — extend the existing US flow with a CAD variant. Do NOT add Playwright specs to this task.

## Open questions

- **Geo-detection accuracy.** What if Vercel's geo header is wrong for a real Canadian on a US ISP (or vice versa)? The toggle override is the user-facing answer. **Telemetry to add:** log toggle-flip events with `{ detected, chosen }` so we can measure default-vs-choice agreement. If it drifts below ~95%, revisit detection (e.g. cross-check `Accept-Language` more aggressively or fall back to ipinfo.io).

## Resolved decisions

- **USD billing-address validation is permissive.** Any country may pay USD; only `currency === 'CAD'` requires `country === 'CA'`. Rationale: small price spread, USD is the international fallback. Revisit when introducing high-PPP-discount markets.
- **CRA federal GST/HST is deploy-blocking; provincial PST/QST/RST is not.** Decision (revised after [`../../business/stages.md`](../../business/stages.md)): only the CRA federal GST/HST registration must be filed + entered into Stripe Tax before this task ships. Provincial registrations (BC PST, SK PST, MB RST, QST) are deferred to Stage 2 — register reactively when the first paying customer in that province appears. Pre-registering provincially creates filing burden (zero-dollar returns) without business value at MVP. See "Tax compliance gate" under Implementation notes.
- **Help-doc on currency switching ships with this task.** New page at `/help/billing/changing-currency` linked from account settings (next to Manage billing) and the Pro Success screen.
