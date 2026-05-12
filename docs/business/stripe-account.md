# Stripe account configuration

How Speclyy's Stripe account is set up to mirror our business posture (Canadian-resident, dual-currency, treaty-protected). Cross-references [`tax-canada.md`](tax-canada.md), [`tax-us.md`](tax-us.md), and the engineering side of billing in [`../architecture/billing.md`](../architecture/billing.md).

---

## Account country & residency

| | |
|---|---|
| **Stripe account country** | **Canada** (Stripe Canada — `https://dashboard.stripe.com/`) |
| **Tax ID on file** | CRA Business Number — same one used for GST/HST registration |
| **Default settlement currency** | CAD |
| **Other supported settlement currencies** | USD (with a USD-denominated CAD bank account; see "Banking" below) |

> ⚠️ **Verify in Settings → Account details.** If Stripe shows the country as United States, that's wrong — it means the account was incorrectly set up as Stripe US (probably because someone signed up while travelling or via a US billing address). Migration to Stripe Canada is **possible but painful** — talk to Stripe support early.

---

## Banking — dual-currency setup

Speclyy receives revenue in two currencies. Without a USD bank account, Stripe Canada force-converts USD payouts to CAD at Stripe's FX rate (currently ~2% above mid-market — meaningful drag on US revenue).

### Recommended setup

| Currency | Account type | Bank options |
|---|---|---|
| **CAD** | Canadian-dollar chequing | Any Canadian business bank (RBC, BMO, TD, Scotia, CIBC, ATB) |
| **USD** | USD-denominated chequing held at a Canadian bank | RBC USD chequing, BMO USD chequing, TD USD chequing — easiest paths |

Both accounts live at the same Canadian bank; the USD account holds USD without converting to CAD. Stripe pays out per-currency to per-currency accounts.

### Stripe payout configuration

**Settings → Payouts → External accounts**

1. Add CAD chequing as the **default** payout account.
2. Add USD chequing as the **USD-currency** payout account.
3. Stripe routes per-currency revenue to the matching external account.

### Why this matters

Without a USD account, every USD payout costs you ~2% in FX spread. Over a year of US revenue, that's significant — for a $200k USD ARR business, ~$4k/yr in avoidable FX costs. Setting up a USD chequing account at a Canadian bank takes ~15 minutes online.

---

## Required tax forms on Stripe

| Form | Purpose | When |
|---|---|---|
| **W-8BEN-E** | Declares Canadian residency + claims Canada-US treaty Article VII; avoids 30% IRS withholding on USD payouts | **Before going live** — see [`tax-us.md`](tax-us.md) § W-8BEN-E |

Filed via **Settings → Tax forms** in the Stripe dashboard. Renew every 3 years or whenever business details change. **This is non-optional** — without it, Stripe withholds 30% of every US-source dollar.

---

## Stripe Tax registrations

Speclyy is registered for tax collection in jurisdictions where the customer base requires it. The current state and the planned trajectory:

### Canadian registrations

| Jurisdiction | Stripe Tax → Registrations entry | Status | Triggered by |
|---|---|---|---|
| Canada — Federal (GST + HST provinces) | "Canada" with CRA Business Number `XXXXXXXXX RT0001` | **Required** before CAD launch | Voluntary registration ([`tax-canada.md`](tax-canada.md) § "register voluntarily") |
| Canada — British Columbia (PST) | "Canada — British Columbia" | Add when first BC customer | BC PST nexus |
| Canada — Saskatchewan (PST) | "Canada — Saskatchewan" | Add when first SK customer | SK PST nexus |
| Canada — Manitoba (RST) | "Canada — Manitoba" | Add when first MB customer | MB RST nexus |
| Canada — Quebec (QST) | "Canada — Quebec" | Add when first QC customer | QST nexus |
| Canada — Alberta | n/a | **Never** — no AB PST exists | n/a |

> **TBD — fill in once registered:**
> - CRA Business Number / GST account: `XXXXXXXXX RT0001`
> - Date GST/HST registration became effective:
> - Filing frequency assigned by CRA:

### US registrations

Empty until economic nexus is crossed in any state that taxes SaaS. See [`tax-us.md`](tax-us.md) § "State sales tax — register reactively" for the playbook.

| State | Registration ID | Date registered | Notes |
|---|---|---|---|
| _(none yet — register on nexus)_ | | | |

When the first state nexus is hit, fill this table in along with the corresponding Stripe Tax → Registrations entry.

---

## Customer Portal configuration

Configured in **Settings → Billing → Customer portal**. Locked-in choices:

| Setting | Value | Why |
|---|---|---|
| **Plan switching** | **OFF** | Not supported in MVP per [`../implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md`](../implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md). Adding a price to a product can silently re-enable this — verify after each pricing change. |
| **Currency switching** | (not a Stripe setting) | Not supported. Cancel + re-subscribe is the documented path; help-doc at `/help/billing/changing-currency`. |
| Cancel subscriptions | ON | Standard self-serve. |
| Update payment method | ON | Standard. |
| Invoice history | ON | Required for Canadian B2B customers (they need GST-bearing invoices for their own ITC claims). |
| Update billing address | ON | Required for Stripe Tax to recompute correctly when a customer relocates. |
| Update tax IDs | OFF (for now) | Add later if B2B Canadian customers ask to register their own GST numbers for reverse-charge invoicing. |

---

## API keys, webhooks, env wiring

Engineering side — see [`../implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md`](../implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md). Test-mode and live-mode keys are isolated:

| Environment | Stripe mode | Where keys live |
|---|---|---|
| Local dev | Test | `.env.local` |
| Vercel preview | Test | Vercel env (Preview + Development scope) |
| Vercel production | **Live** | Vercel env (Production scope only) |

> 🚨 **A leaked `sk_live_…` in a preview env is a billing incident.** Verify Vercel scoping after every env change.

---

## Branding (Settings → Branding)

Affects PaymentElement (embedded Stripe Elements), Customer Portal, hosted invoices, and emails Stripe sends on Speclyy's behalf.

| Field | Speclyy value |
|---|---|
| Display name | `Speclyy` |
| Logo | Speclyy mark (square, dark-bg + light-bg variants) |
| Icon | Speclyy favicon |
| Brand color | (per design tokens) |
| Accent color | (per design tokens) |
| Statement descriptor | `SPECLYY` (or `SPECLYY.COM` if you prefer the URL — must be ≤22 chars including spaces) |

Statement descriptor is what shows up on the customer's credit-card statement. Keep it recognizable to reduce chargebacks ("I don't recognize this charge").

---

## Customer email automations

**Settings → Customer emails** — flip these ON; Stripe sends them on Speclyy's behalf, no app code:

- ✅ **Successful payments** — receipt sent on every paid invoice. Required for tax-record-keeping on the customer's side.
- ✅ **Refunds** — sent automatically when you issue a refund.
- ✅ **Subscription updates** — informs customer of upcoming price changes (we don't change prices in MVP, but enable for future-proofing).
- 🟡 **Failed payment retries** — Stripe Smart Retries handles dunning automatically; the email keeps the customer in the loop.

---

## Account activation (going live) — checklist

The **Activate payments** banner in Stripe lists what's blocking live mode. For Speclyy, expect to need:

| Requirement | Where | Status |
|---|---|---|
| Legal business name + structure | Settings → Account details | TBD |
| Business address (Calgary HQ) | Settings → Account details | TBD |
| CRA Business Number | Settings → Tax details | TBD |
| Bank account for CAD payouts | Settings → Payouts | TBD |
| Bank account for USD payouts (recommended) | Settings → Payouts | TBD |
| Director/owner identity verification | Stripe-prompted | TBD |
| W-8BEN-E filed | Settings → Tax forms | TBD |
| Branding | Settings → Branding | TBD |

Stripe walks you through these one at a time. Knock them all out *before* the live-mode mirror in [TASK-BILL-01](../implementation-tasks/billing-subscription/TASK-BILL-01-stripe-provisioning.md) Phase 5.

---

## Account security

- **2FA on the Stripe account** — required, no exceptions. Use a TOTP app (1Password, Authy) — not SMS.
- **Owner email** — use a role-based address (`finance@speclyy.com` or similar) rather than a personal email, so the Stripe account survives a founder change.
- **Restricted API keys** for any integration outside of the main app — Stripe supports per-key scoping.
- **Audit log** — `Developers → Logs` shows every API call. Review monthly for anomalies.
- **Webhook signature verification** is implemented in [TASK-BILL-05](../implementation-tasks/billing-subscription/TASK-BILL-05-stripe-webhook-handler.md) — never trust an unverified webhook payload.

---

## Reference table — what lives where

| Concern | Stripe-side | App-side |
|---|---|---|
| Plan definitions (price IDs, amounts) | Products & prices on the dashboard | `apps/web/src/lib/billing/plans.ts` reads price IDs from env |
| Customer portal availability | Settings → Billing → Customer portal | `createPortalSession()` Server Action |
| Tax computation | Stripe Tax (registrations + `automatic_tax: true`) | (none — fully Stripe-side) |
| Currency selection | n/a (per-Price denomination) | Currency-keyed `PLANS[currency][interval]` |
| Webhook delivery | Settings → Webhooks endpoint config | `apps/web/src/app/api/webhooks/stripe/route.ts` |
| W-8BEN-E | Settings → Tax forms | n/a |
| Banking & payouts | Settings → Payouts | n/a |
