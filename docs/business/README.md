# Business — Speclyy

Reference docs covering Speclyy's legal/tax/banking posture as a business entity. These are **operational guidance**, not legal or tax advice — confirm anything material with a Canadian cross-border accountant before acting.

## At a glance

| | |
|---|---|
| **Headquartered** | Calgary, Alberta, Canada |
| **Tax residency** | Canadian-resident |
| **Business activity** | SaaS — sold globally |
| **Pricing currencies** | USD (default), CAD (Canadian customers) — see [`../architecture/billing.md`](../architecture/billing.md) |
| **Physical infra** | None — cloud-only (Vercel, Supabase). No US/EU presence. |
| **Sales tax regimes engaged** | Canadian GST/HST (federal); Canadian provincial PST/QST/RST (reactive); US state sales tax (reactive) |
| **Income tax** | Canadian only (T2 federal + Alberta) under Canada–US treaty protection |

## Index

- **[`stages.md`](stages.md)** — **Start here.** Compliance posture by ARR stage. What's required at MVP (two forms), what's deferred to Stage 2 (reactive registration), and when to consider a Merchant of Record at Stage 3+. The other docs are *reference*; this one is the *playbook*.
- [`jurisdiction.md`](jurisdiction.md) — Calgary-based, Canadian-resident, why we have no Permanent Establishment outside Canada, and what would change that.
- [`tax-canada.md`](tax-canada.md) — GST/HST, provincial sales taxes, registration thresholds, place-of-supply rules, Input Tax Credits.
- [`tax-us.md`](tax-us.md) — US state sales tax (post-*Wayfair*) and US federal income tax (treaty). W-8BEN-E and EIN paperwork.
- [`stripe-account.md`](stripe-account.md) — How the Stripe account is configured to mirror this business posture: Stripe Canada, dual-currency banking, tax registrations panel.

## Cross-references in the rest of the codebase

- [`../architecture/billing.md`](../architecture/billing.md) § "Currency & regional pricing" and § "Stripe Tax" — engineering side of multi-currency + tax collection.
- [`../implementation-tasks/billing-subscription/TASK-BILL-09-cad-pricing-expansion.md`](../implementation-tasks/billing-subscription/TASK-BILL-09-cad-pricing-expansion.md) — task that wires Canadian tax collection into the Stripe + app flow. The "Tax compliance gate" in that task references this folder for the registration runbook.
- [`../architecture/operations/stripe-provisioning.md`](../architecture/operations/stripe-provisioning.md) — the provisioning runbook (introduced in TASK-BILL-01) cross-links here for the tax-registration steps.

## Disclaimer

This documentation captures the team's working understanding of Canadian and US tax obligations for an early-stage Canadian SaaS company selling globally. Tax law is jurisdiction-specific and changes over time. Before any of the following:

- Filing or amending a tax return
- Registering for a new tax (any province, any state)
- Hiring an employee or contractor outside Canada
- Opening a US bank account or US-domiciled subsidiary
- Crossing $1M+ ARR

…confirm with a **Canadian cross-border accountant** (CPA with cross-border SaaS experience) and, where US-specific, a **US-licensed tax advisor** they refer you to. The cost of an hour of their time is dwarfed by the cost of a missed registration.
