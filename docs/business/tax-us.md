# US tax — cross-border obligations

How Speclyy, a Canadian-resident SaaS company, navigates US tax obligations on its US-customer revenue. **Two separate regimes** to think about: federal income tax (mostly handled by the Canada–US treaty) and state sales tax (handled state-by-state, post-*Wayfair*).

> **Not legal/tax advice.** Cross-border tax is full of edge cases — verify with a Canadian CPA who has US-cross-border SaaS experience, plus a US-licensed advisor where they refer you.

> **Read [`stages.md`](stages.md) first.** That doc explains *when* to do what; this doc explains *how*. Most of the state-by-state material below is Stage 2+ — at MVP you only need W-8BEN-E.

---

## MVP-stage minimum (Stage 1)

**File Form W-8BEN-E with Stripe. That's it.**

One form, filed once, renewed every 3 years. It claims Canada–US treaty protection (Article VII — Business Profits) so Stripe doesn't apply 30% backup withholding to your USD payouts. Without it, a third of your US revenue disappears at payout time.

You do **not** need:
- A US EIN (your CRA Business Number is sufficient as the foreign TIN on W-8BEN-E).
- US state sales-tax registrations (none — you're below every state's economic-nexus threshold at MVP).
- A US bank account.
- A US subsidiary or any US presence.

The state-by-state nexus material below is for **Stage 2** — when Stripe Tax monitoring (or your quarterly review) flags a state approaching its threshold. Until then, Stripe collects $0 of US sales tax, and that's correct.

---

## US federal income tax — protected by treaty

### The default rule

The IRS treats payments from US sources as US-taxable unless a treaty exemption applies. Without protection, Stripe (and other US payors) would withhold **30%** of every payout to Speclyy and remit it to the IRS as backup withholding.

### The Canada–US treaty exemption

Article VII (Business Profits) of the [Canada–US Tax Treaty](https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/country/united-states-america-convention-consolidated-1980-1983-1984-1995-1997-2007.html) exempts a Canadian business's profits from US tax **unless** those profits are attributable to a Permanent Establishment (PE) in the US.

**Speclyy currently has no PE** ([`jurisdiction.md`](jurisdiction.md) § Permanent Establishment). Result: US-source revenue is exempt from US federal income tax. We pay Canadian T2 only.

### The required paperwork — W-8BEN-E

The treaty exemption isn't automatic. You **must declare it** to US payors using **IRS Form W-8BEN-E** (Certificate of Status of Beneficial Owner for United States Tax Withholding and Reporting — Entities).

> 🚨 **This is the single most important US-side action.** Without W-8BEN-E on file, Stripe applies 30% backup withholding to your USD payouts. That's a third of your US revenue, gone, until you file the form.

#### What W-8BEN-E declares

| Section | What you put |
|---|---|
| Part I — Identification | Speclyy's legal name, country of incorporation (Canada), Calgary address, **CRA Business Number** as the foreign TIN |
| Part I, Line 5 — Entity type | "Corporation" (assuming Speclyy is incorporated) |
| Part III — Treaty claim | Check "Canada"; cite **Article VII (Business Profits)**; reason: no PE in the US |
| Part XXX — Certification | Authorized officer signature |

You don't need a US EIN to file W-8BEN-E — your CRA BN is sufficient as the foreign TIN.

#### Where to file with Stripe

Stripe asks for it during account verification or the first time US payments hit. In dashboard:

1. **Settings → Tax forms → W-8BEN-E** (or follow the prompt Stripe emails).
2. Fill in the digital form (same fields as the IRS PDF).
3. Submit. Stripe stores it; renews every 3 years or whenever your business details change.

#### When to file

**Before going live with US revenue**. If you've already received US payments without W-8BEN-E filed, file ASAP — Stripe may apply withholding retroactively to undocumented payouts.

---

## US state sales tax — register reactively

> **Stage 2 — triggered when a state approaches its nexus threshold.** Not relevant at MVP.

Completely separate from federal income tax. The post-*Wayfair* (2018) economic-nexus regime applies to **any** seller (Canadian, foreign, doesn't matter) once you cross a state's threshold.

Until you cross a threshold, Stripe Tax collects $0 of US sales tax — that's the correct posture for a pre-nexus seller. The quarterly Stripe Tax review described in [`stages.md`](stages.md) § Stage 2 is what catches the trigger.

### The mental model

```
Per state:
  ↓
  (1) Does this state tax SaaS at all? — ~24 yes, ~19 no, rest unclear
  ↓ yes
  (2) Have we crossed this state's economic-nexus threshold this year?
  ↓ yes
  (3) Register with the state → paste registration ID into Stripe Tax → done
  ↓ no
  (4) Wait — re-evaluate quarterly
```

### Typical thresholds

| State | Economic nexus threshold | Taxes SaaS? |
|---|---|---|
| California | $500k revenue | No |
| New York | $500k revenue + 100 transactions | Yes (some categories) |
| Texas | $500k revenue | Yes |
| Florida | $100k revenue | No (general SaaS exempt) |
| Washington | $100k revenue | Yes |
| Pennsylvania | $100k revenue | Yes |
| Illinois | $100k revenue + 200 transactions | Limited |
| Massachusetts | $100k revenue | Yes |
| Ohio | $100k revenue + 200 transactions | Yes |
| Most "$100k or 200 transactions" states | varies | varies |

> 📊 **Check the current map** at [TaxJar's SaaS sales-tax map](https://www.taxjar.com/resources/blog/saas-sales-tax) or [Avalara's state-by-state SaaS taxability index](https://www.avalara.com/blog/en/north-america/2021/02/are-software-as-a-service-saas-and-cloud-computing-services-taxable-in-the-united-states.html) — these change every legislative session.

### What happens before nexus

You charge $0 US sales tax. `automatic_tax: { enabled: true }` is on in Stripe but the registrations panel has no US states listed → Stripe collects nothing. This is **correct** for a pre-nexus seller; don't over-comply.

### What happens when you cross nexus

For each state where you cross the threshold and the state taxes SaaS:

1. **Get a US EIN** (if you don't have one yet — see below). One-time, applies to all states.
2. **Register with the state's Department of Revenue** for sales-tax collection.
3. **Paste the state registration ID into Stripe Tax → Registrations.**
4. Stripe begins collecting that state's rate from customers in that state, automatically.
5. **File state sales-tax returns** at the state's required cadence (usually monthly or quarterly).

Most US states allow online registration; turnaround is days to weeks. Some require posting a bond as a foreign seller — your accountant handles this.

### Streamlined Sales Tax (SST) — the shortcut

24 states are members of the [Streamlined Sales Tax](https://www.streamlinedsalestax.org/) program, which lets you file **one consolidated registration** that covers all SST member states. For a Canadian SaaS that's likely to cross nexus in multiple states simultaneously, SST is a meaningful efficiency gain — ask your US-side advisor whether it makes sense once you're approaching multi-state nexus.

---

## US EIN — when, why, and how

> **Stage 2 — get one only when first US-state nexus is crossed.** Don't pre-fetch.

### What it is

An **Employer Identification Number** (EIN) is a 9-digit IRS-issued tax ID for entities. Despite the name, you don't need to have employees to get one.

### When Speclyy needs one

- **First time you register for sales tax in any US state.** Most states require an EIN even from foreign sellers.
- **Possibly: Stripe asks for one.** Stripe usually accepts a foreign TIN (your CRA BN) on W-8BEN-E, but in some flows they ask for an EIN. If they ask, get one.
- **If you ever open a US bank account.** Required.
- **NOT needed** for: filing W-8BEN-E (CRA BN is fine), receiving Stripe payouts, paying Canadian taxes.

### How to get one as a Canadian entity

The IRS online EIN application is **not available** to foreign entities (it requires a US-based individual's SSN/ITIN). Three options:

1. **Phone application — fastest.** Call the IRS International EIN line at **+1-267-941-1099** (Mon–Fri, 6am–11pm ET). Have IRS Form SS-4 filled out in front of you. Wait time: 30 min – 2 hours on hold; call itself: ~15 minutes. EIN issued on the call.
2. **Mail / fax SS-4** — slower (4–8 weeks). Fax to **+1-855-215-1627**.
3. **Through a US-based agent** — your cross-border accountant can apply on your behalf with a Form 8821 (Tax Information Authorization).

### One-time. Permanent.

Once issued, the EIN is yours forever. Never expires. Used for all future state registrations + any IRS forms.

---

## What Speclyy does **not** owe

| Tax | Status |
|---|---|
| US federal corporate income tax | ❌ No — treaty protected (no PE) |
| State corporate income tax | ❌ No (with some California-franchise-tax edge cases — confirm with advisor if expanding into CA) |
| State sales tax in non-nexus states | ❌ No |
| State sales tax in states that don't tax SaaS | ❌ No (even with nexus) |
| US payroll taxes | ❌ No (no US employees) |
| FICA / Social Security on Canadian employees serving US customers | ❌ No (Canada–US Totalization Agreement) |

---

## What Speclyy **does** owe (or will, eventually)

| Obligation | When it kicks in | What to do |
|---|---|---|
| File W-8BEN-E with Stripe | Now (before going live in USD) | Stripe → Settings → Tax forms |
| Get an EIN | First time you cross any US state's sales-tax nexus | Phone IRS at +1-267-941-1099 with completed SS-4 |
| Register for sales tax in [State X] | Once you cross [State X]'s economic nexus AND state taxes SaaS | State Dept of Revenue website, then Stripe Tax → Registrations |
| File state sales-tax returns | Monthly / quarterly per state's schedule | Accountant + Stripe Tax data export |
| File annual T2 in Canada | Always | Accountant — separate from this doc |

---

## Watching for nexus — operational checklist

Once a quarter, run a Stripe Sigma query (or export):

```sql
SELECT
  customer_address_state,
  COUNT(DISTINCT customer_id) AS unique_customers,
  COUNT(*) AS transactions_last_12mo,
  SUM(amount_paid) / 100 AS revenue_usd_last_12mo
FROM charges
WHERE customer_address_country = 'US'
  AND created >= now() - INTERVAL '12 months'
GROUP BY customer_address_state
ORDER BY revenue_usd_last_12mo DESC;
```

For any state showing >$80k revenue or >150 transactions, **start the registration process now** — most thresholds are $100k/200, and there's typically 30–60 days between crossing and the registration deadline.

---

## Reading list

- [IRS Form W-8BEN-E + instructions](https://www.irs.gov/pub/irs-pdf/fw8bene.pdf)
- [IRS Form SS-4 + instructions](https://www.irs.gov/pub/irs-pdf/fss4.pdf)
- [Canada–US Tax Treaty (full text)](https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/country/united-states-america-convention-consolidated-1980-1983-1984-1995-1997-2007.html)
- [South Dakota v. Wayfair, Inc.](https://www.supremecourt.gov/opinions/17pdf/17-494_j4el.pdf) — the case that created economic nexus
- [Streamlined Sales Tax — Multistate registration](https://www.streamlinedsalestax.org/)
- [Stripe Tax — Sales tax in the United States](https://stripe.com/docs/tax/supported-countries/united-states)
