# Canadian tax — sales tax

Speclyy's domestic sales-tax obligations as an Alberta-based, Canadian-resident SaaS company. **Income tax (T2 corporate) is separate** — your accountant handles annual filings; this doc is about the recurring sales-tax compliance that touches Stripe.

> **Not legal/tax advice.** Confirm with a Canadian CPA before acting on any of this.

> **Read [`stages.md`](stages.md) first.** This page is the *reference*; that one is the *playbook* — what to do now vs. later. Most of the detail below is for Stage 2+; the MVP-stage minimum is just one registration.

---

## MVP-stage minimum (Stage 1)

**Register for CRA federal GST/HST. That's it.**

One registration, one filing, covers Alberta + the 5 HST provinces (ON, NB, NS, PE, NL) + the 3 territories (NT, NU, YT). Stripe Tax then computes the correct rate per customer-province automatically once the registration ID is pasted into Stripe.

**Do not** pre-register for BC PST, SK PST, MB RST, or QST at MVP. These have their own filing obligations (zero-dollar returns count) and create more compliance surface than they save. Wait until a customer in that province actually subscribes — see "Provincial registrations — register reactively" below for the trigger playbook.

The remainder of this page is reference material for when those triggers fire.

---

## The Canadian sales-tax map

Canada has **one federal** sales tax (GST) and **several provincial** sales taxes. Some provinces have merged the two into a single Harmonized Sales Tax (HST) that CRA collects on the province's behalf.

| Province | Tax type | Rate | Who administers | Speclyy registration required? |
|---|---|---|---|---|
| **Alberta (home)** | GST only | 5% | CRA | ✅ CRA federal |
| **NT, NU, YT** | GST only | 5% | CRA | ✅ CRA federal (same one) |
| **Ontario** | HST | 13% | CRA | ✅ CRA federal (HST collected through GST registration) |
| **New Brunswick** | HST | 15% | CRA | ✅ CRA federal |
| **Nova Scotia** | HST | 15% | CRA | ✅ CRA federal |
| **Prince Edward Island** | HST | 15% | CRA | ✅ CRA federal |
| **Newfoundland & Labrador** | HST | 15% | CRA | ✅ CRA federal |
| **British Columbia** | GST + PST | 5% + 7% | CRA + BC | ✅ CRA + 🟡 BC PST registration if BC customers |
| **Saskatchewan** | GST + PST | 5% + 6% | CRA + SK | ✅ CRA + 🟡 SK PST registration if SK customers |
| **Manitoba** | GST + RST | 5% + 7% | CRA + MB | ✅ CRA + 🟡 MB RST registration if MB customers |
| **Quebec** | GST + QST | 5% + 9.975% | CRA + Revenu Québec | ✅ CRA + 🟡 QST registration if QC customers |

**One CRA registration covers** Alberta + the territories + all 5 HST provinces. Provincial registrations only become necessary as you start serving customers in BC, SK, MB, or QC.

---

## GST/HST registration — when and why

> **Stage 1 — required at MVP.** This is the one Canadian registration you file before launch.

### Mandatory threshold

You **must** register once your worldwide taxable supplies (revenue from taxable sales) exceed **CA$30,000 over any 4 consecutive calendar quarters**. For a Canadian-resident registrant:

- "Worldwide taxable supplies" includes **zero-rated** supplies — so your USD revenue from US customers counts toward the threshold even though you don't charge GST on it.
- Threshold is rolling, not calendar-year. Once you cross, you have **29 days** to register.
- Failure to register triggers back-tax assessments + interest + penalties.

### Recommended: register voluntarily, before the threshold

For a SaaS company, **register on day one** even if you're below $30k. Two reasons:

1. **Input Tax Credits (ITCs).** Once registered, every dollar of GST you pay on business expenses is reclaimable from CRA. SaaS expenses where this matters:
   - Vercel — bills GST when invoiced from a Canadian entity
   - Supabase — bills GST for Canadian customers
   - Anthropic / OpenAI / model providers — varies; some bill HST/GST
   - Domain registrars, accounting software, professional services
   - Office rent, equipment, software subscriptions
   - Even if your individual GST per-invoice is small, this typically reclaims **CA$1,000–5,000/year** for an early-stage SaaS.

2. **Compliance posture.** No "did we just cross the threshold last quarter?" anxiety. No back-registration headache. B2B Canadian customers prefer GST-registered vendors so they can claim their own ITCs.

### What to file

**Apply for a GST/HST account** at [canada.ca → Business Registration Online](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/registering-your-business/business-registration-online-overview.html). You need:

- Your CRA Business Number (BN) — if Speclyy is incorporated, you already have one. If sole prop, register simultaneously.
- Estimated annual revenue (for filing-frequency assignment).
- Effective date — pick the earlier of (a) date you started taxable activity or (b) today.

CRA issues a **9-digit BN + `RT0001` GST/HST account suffix** (your full GST number looks like `123456789RT0001`). This goes into Stripe Tax → Registrations.

### Filing frequency

CRA assigns a frequency based on annual revenue:

| Annual taxable revenue | Default filing frequency |
|---|---|
| ≤ CA$1.5M | Annual |
| CA$1.5M – CA$6M | Quarterly |
| > CA$6M | Monthly |

Annual filing is the easiest for early-stage. Your accountant prepares it from Stripe + accounting data.

---

## Provincial registrations — register reactively

> **Stage 2 — triggered on first customer in province.** Do not pre-register before MVP launch.

Don't pre-register for BC PST, SK PST, MB RST, or QST. Register the **first time you have a paying customer in that province**. Stripe Tax under-collects until the registration is added, which is the conservative posture (you can issue an apology + correction; it's much harder to refund tax you should never have collected).

The quarterly Stripe Tax review described in [`stages.md`](stages.md) § Stage 2 is the operational rhythm that catches these triggers.

### Quick links

| Province | Registration | Threshold for foreign sellers |
|---|---|---|
| BC PST | [bcregistry.gov.bc.ca](https://www.gov.bc.ca/gov/content/taxes/sales-taxes/pst/register) | CA$10k of BC sales/yr (very low — register once you have any meaningful BC presence) |
| SK PST | [sets.gov.sk.ca](https://www.sets.saskatchewan.ca/) | No threshold for non-residents; threshold for residents |
| MB RST | [gov.mb.ca/finance/taxation](https://www.gov.mb.ca/finance/taxation/) | CA$10k threshold (similar to BC) |
| QC QST | [revenuquebec.ca](https://www.revenuquebec.ca/en/businesses/) | CA$30k threshold for digital service providers |

For Canadian-resident registrants like Speclyy, the **resident** rules apply (which are generally stricter — register sooner). Confirm with your accountant when triggering.

---

## Place of supply — where the customer sits, not where you do

As a Canadian-resident registrant, you charge tax based on the **customer's** province of consumption, not Alberta:

```
Customer in:                         You charge:
─────────────────────────────────────────────────────────
Alberta (your home)                  5% GST only
Ontario / NB / NS / PE / NL          13–15% HST (combined federal+provincial)
NT / NU / YT                         5% GST only
BC                                   5% GST + 7% PST (if BC PST registered)
SK                                   5% GST + 6% PST (if SK PST registered)
MB                                   5% GST + 7% RST (if MB RST registered)
QC                                   5% GST + 9.975% QST (if QST registered)
US / EU / anywhere outside Canada    0% — zero-rated for export
```

Stripe Tax computes all of this automatically once you've registered for the relevant taxes and `automatic_tax: { enabled: true }` is set on the Subscription create call ([`../architecture/billing.md`](../architecture/billing.md) § Stripe Tax).

---

## Zero-rated vs. exempt — why exports help your ITC math

US/international sales are **zero-rated**, not exempt. The distinction matters:

- **Zero-rated**: technically a taxable supply at 0%. You charge no tax, but you can still claim ITCs on related expenses. ← This is what applies to Speclyy's US revenue.
- **Exempt**: not a taxable supply at all. No tax charged, but you also can't claim ITCs on related expenses. (Examples: most financial services, healthcare, residential rent — not relevant to Speclyy.)

For a SaaS company with mixed Canadian + US revenue, ITCs are claimable across the board.

---

## Filing cadence (what you actually do at year-end)

1. **Stripe → Reports → Tax** — exports tax-summary CSVs broken down by jurisdiction.
2. Your accountant matches Stripe's output to your accounting system (QuickBooks, Xero, Wave).
3. **GST/HST return**: net = (GST/HST collected) − (ITCs on expenses). If ITCs > collected (common in year 1 with high cloud/infra spend), CRA issues you a refund.
4. **QST / PST / RST returns** filed separately if applicable.
5. **T2 corporate income tax return** filed federally + Alberta — separate from sales tax. Standard accountant deliverable.

---

## Reading list

- [Canada Revenue Agency — GST/HST for businesses](https://www.canada.ca/en/services/taxes/excise-taxes-duties-and-levies/gst-hst-businesses.html)
- [Place of supply rules — CRA Memorandum 3-6](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-6/place-supply.html)
- [Stripe Tax — Canada documentation](https://stripe.com/docs/tax/supported-countries/canada)
