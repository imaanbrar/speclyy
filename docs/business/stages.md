# Compliance by stage — what to do *now* vs. *later*

The hardest thing about cross-border SaaS tax is that the docs on the internet describe the **end-state** (every registration you'll ever need) without telling you what's safe to defer. This page is the answer to "what's the *minimum* I need to ship Speclyy and stay compliant?" — staged by ARR.

> **Anchoring rule.** Every "register reactively" recommendation here depends on **`automatic_tax: { enabled: true }`** being on in Stripe from day one. That's the kill-switch — it gives you a live monitor of where customers are buying so you can register *the moment* you cross a threshold, instead of pre-registering everywhere "just in case". See [`stripe-account.md`](stripe-account.md) § Stripe Tax registrations.

---

## The four stages at a glance

| Stage | ARR band | What's compliance-critical | What you can defer |
|---|---|---|---|
| **1 — MVP** | $0 → ~$30k | **CRA GST/HST registration** + **W-8BEN-E with Stripe**. Done. | Provincial PST/QST/RST. US state registrations. EIN. Tax compliance SaaS. |
| **2 — Early growth** | ~$30k → ~$500k | Reactive provincial registrations (BC/SK/MB/QC) on first customer. Quarterly US-state nexus check. EIN if/when first US-state nexus crossed. Fractional cross-border CPA on retainer. | Tax compliance SaaS. MoR migration. EU/UK VAT (until you have meaningful EU revenue). |
| **3 — Scaling** | ~$500k → ~$2M | Tax compliance SaaS (Anrok / TaxJar / Quaderno) **or** Merchant-of-Record migration decision. Multiple US-state registrations almost certain. EU/UK VAT if EU revenue is meaningful. | Per-state DIY filings (the SaaS handles them). |
| **4 — Mature** | ~$2M+ | Either: (a) full in-house compliance with SaaS-assisted filings *or* (b) MoR shouldering global tax. Annual review with international tax counsel. | Building any of this from scratch. |

The arrow of time goes one way — once you're past Stage 1 you don't go back. But Stages 2 → 3 are a **decision fork**, not a march: you can stay DIY-with-tooling forever, or pivot to MoR, depending on how international your revenue mix becomes.

---

## Stage 1 — MVP ($0 → ~$30k ARR)

**The goal: ship without becoming non-compliant. Two forms. That's it.**

### What you must do

| Action | Where | Why |
|---|---|---|
| **Register for CRA federal GST/HST** | [canada.ca → Business Registration Online](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/registering-your-business/business-registration-online-overview.html) | Covers Alberta + 5 HST provinces + 3 territories with one registration. Voluntary at this stage but recommended — see [`tax-canada.md`](tax-canada.md) § "register voluntarily". Enables ITCs (reclaim GST on cloud spend). |
| **File W-8BEN-E with Stripe** | Stripe → Settings → Tax forms | Without it, Stripe withholds 30% of every USD payout. See [`tax-us.md`](tax-us.md) § W-8BEN-E. |

That's the entire Stage-1 list. No provincial registrations. No US state registrations. No EIN. No EU VAT.

### What you must NOT do

- **Pre-register for provincial sales tax (BC PST, SK PST, MB RST, QST)** before you have a customer in that province. Empty registrations create filing obligations (zero-dollar returns) you'll forget about, leading to penalties for missed filings of $0.
- **Get a US EIN "just in case".** It's not needed for W-8BEN-E (CRA BN suffices) and creates ongoing IRS visibility. Get one only when a US state actually requires it for sales-tax registration — see Stage 2.
- **Engage tax compliance SaaS or a Merchant of Record.** Both are appropriate at scale; both are over-engineering at MVP. Stripe Tax + a quarterly nexus check is the right tooling for $0–$500k.
- **Register for EU VAT through OSS** unless you're actively pursuing EU customers. EU revenue is zero-rated for export from Canada until you cross EU thresholds — and the OSS scheme is non-trivial to file.

### What "shipping" looks like at this stage

```
Stripe configuration:
  ✅ Account country: Canada
  ✅ W-8BEN-E filed
  ✅ automatic_tax: { enabled: true }
  ✅ Stripe Tax → Registrations: one entry, "Canada" with CRA BN
  ❌ No US-state registrations
  ❌ No provincial PST/QST/RST registrations

Outcome on a USD invoice (US customer):
  Tax line: $0 — pre-nexus, no obligation. Correct.

Outcome on a CAD invoice (Ontario customer):
  Tax line: HST 13% — collected, remitted to CRA quarterly/annually.

Outcome on a CAD invoice (BC customer):
  Tax line: GST 5% only. PST 7% NOT collected — we're not registered for BC PST yet.
  → If this happens, BC customer is a Stage-2 trigger (see below).
```

This posture is **conservative** — you under-collect provincial tax until registered, which is correctable. You **never** over-collect tax on customers in provinces where you have no registration.

### Cost of Stage 1

- **Time:** ~half a day. CRA BRO is a 30-minute online form; W-8BEN-E is a Stripe-dashboard wizard.
- **Money:** $0 in agency fees. Maybe one hour of a cross-border CPA's time ($200–$400) to confirm you've ticked the right boxes.

### What graduates you to Stage 2

Any **one** of:

- A customer in BC, SK, MB, or QC subscribes (provincial registration trigger).
- Stripe Tax monitor shows >$80k revenue or >150 transactions in any single US state over rolling 12 months (US-state nexus approaching).
- ARR crosses $30k (CRA registration becomes mandatory — already done if you took voluntary, but the threshold matters for filing-frequency reassessment).

---

## Stage 2 — Early growth (~$30k → ~$500k ARR)

**The goal: react to triggers without pre-empting them. Add registrations one at a time, as customers arrive.**

### Operational rhythm

Once a quarter (calendar quarter is fine), spend an hour on this checklist:

```
1. Stripe → Reports → Tax → export "Tax Summary" CSV.
2. Group by jurisdiction. Look for:
   - New Canadian provinces with paying customers (BC / SK / MB / QC).
     → Trigger: register for the relevant provincial tax.
   - US states with rising revenue. Any state >$80k/yr or >150 tx/yr is approaching nexus.
     → Trigger: brief your accountant; start the registration process if the state taxes SaaS.
3. Stripe → Tax → Registrations: confirm every active registration matches the live IDs.
4. Stripe → Tax → Monitoring tab (the "where might we owe tax?" view).
   → New jurisdictions Stripe flags = candidates for the next CPA conversation.
```

The whole thing takes ~30 min after you've done it twice. Calendarize it.

### When triggered

| Trigger | Action | Lead time |
|---|---|---|
| First customer in BC | Register for BC PST. Add ID to Stripe Tax → Registrations. | 1–2 weeks online. |
| First customer in SK | Register for SK PST. Add ID to Stripe Tax. | 1–2 weeks. |
| First customer in MB | Register for MB RST. Add ID to Stripe Tax. | 1–2 weeks. |
| First customer in QC | Register for QST with Revenu Québec. Add ID to Stripe Tax. | 2–4 weeks (provincial paperwork takes longer). |
| US state nexus approaching ($80k+ in a state that taxes SaaS) | (a) Get a US EIN — phone IRS at +1-267-941-1099 (one-time, ~30 min on hold). (b) Register with state's Department of Revenue. (c) Add ID to Stripe Tax. | 1–6 weeks per state — depends on the state. |
| EU customer revenue becoming non-trivial | Talk to your CPA about EU VAT OSS registration before you cross any threshold. | Defer until Stage 3 unless EU is a deliberate market. |

### Engage a fractional cross-border CPA

By the time you're at $100k+ ARR with multi-province + emerging US revenue, doing this yourself is false economy. A cross-border CPA costs $2k–$5k/year on retainer (a few hours/quarter) and saves you from:

- Missing a registration deadline.
- Filing the wrong return (e.g. quarterly vs. annual frequency).
- Mishandling exempt vs. zero-rated revenue.
- Fumbling the W-8BEN-E renewal (every 3 years).

Look for: **Canadian CPA with cross-border SaaS experience**. Not a generalist. Ask whether they've handled W-8BEN-E and SST registrations specifically.

### What you still don't need at Stage 2

- **Tax compliance SaaS (Anrok / TaxJar / Quaderno / Sphere).** Stripe Tax + a CPA + quarterly DIY review is sufficient until you have ~5+ US-state registrations or are actively pursuing EU/UK markets. The SaaS-versus-Stripe-Tax decision becomes interesting at Stage 3.
- **Merchant of Record migration.** MoR is an ARR-band decision; not an "add this tool" decision. See § "The MoR escape hatch" below. Wait until Stage 3 to even evaluate.
- **EU VAT OSS registration** unless you've crossed €10k of EU revenue (the OSS threshold). Below that, EU revenue is zero-rated for export.

### Cost of Stage 2

- **Time:** ~1 hour/quarter on the operational rhythm + 2–4 hours per registration triggered.
- **Money:** $2k–$5k/year for a fractional CPA retainer; $0–$200 per state registration in fees; some states require a posted bond as a foreign seller (a few hundred dollars, refunded later).

---

## Stage 3 — Scaling (~$500k → ~$2M ARR)

**The goal: stop doing tax compliance manually. Pick a tool stack.**

At this stage, you almost certainly have:

- 3+ US-state registrations (each requires monthly or quarterly filings).
- 2+ Canadian provincial registrations.
- Possibly EU/UK VAT obligations.
- Customers in 10+ countries, even if revenue is concentrated in 2–3.

The DIY-with-CPA approach starts breaking down. Two paths from here.

### Path A — Tax compliance SaaS (DIY+)

Layer compliance tooling on top of your existing Stripe + CPA setup. Examples:

| Tool | Strength | Notes |
|---|---|---|
| **[Anrok](https://anrok.com/)** | SaaS-native, designed for Stripe-based SaaS companies. | Best fit for Speclyy's shape. Auto-files state returns. |
| **[TaxJar](https://www.taxjar.com/)** (Stripe-owned) | Long-established US sales-tax handling. | Now under Stripe's roof but still a separate product; Stripe Tax has overlap. |
| **[Quaderno](https://quaderno.io/)** | International (US, EU, Canada, UK, AU). | Stronger EU/UK story than Anrok. |
| **[Sphere](https://www.getsphere.com/)** | Canadian SaaS-built; deep Canadian provincial coverage. | Good if Canadian revenue is your majority. |

**What they actually do:** monitor your nexus continuously, prompt you when registration is needed, prepare the per-state/province returns, and (for most) auto-file them. You still own the registration paperwork; they own the recurring filings.

**Cost:** $2k–$15k/year depending on volume + jurisdictions.

**Decision criteria:** if you have 4+ US-state registrations *or* are actively expanding into EU/UK, the tool pays for itself by removing CPA-billable hours.

### Path B — Merchant of Record (offload)

Migrate the billing surface from Stripe-direct to a Merchant of Record (MoR). The MoR becomes the legal seller; you become a reseller of services to the MoR. **They** owe the tax in every jurisdiction; you receive net payouts after they handle compliance globally.

Examples:

| MoR | Strength | Notes |
|---|---|---|
| **[Paddle](https://www.paddle.com/)** | The incumbent for global B2B SaaS. | Highest fees; broadest coverage; most enterprise-friendly. |
| **[Lemon Squeezy](https://www.lemonsqueezy.com/)** | Friendlier UX, indie-SaaS focused. | Recently acquired by Stripe — watch for product changes. |
| **[Polar.sh](https://polar.sh/)** | Newer; developer-first. | Less mature; cheap; fits open-source-adjacent tooling. |

**What changes for Speclyy:**

- The Stripe-direct subscription model in [`../architecture/billing.md`](../architecture/billing.md) is replaced by the MoR's checkout/subscription primitives.
- Webhook contracts change — same idempotency table, different event shapes.
- The customer's invoice says "Sold by Paddle" (or similar), not "Speclyy".
- You stop owing tax everywhere except Canada (T2 corporate income tax remains; sales tax is the MoR's problem).

**Cost:** 5–8% of GMV (vs. Stripe's ~3% + your DIY compliance). The premium pays for global tax compliance, currency conversion, dunning, and chargeback handling.

**Decision criteria:** MoR makes sense if (a) you're selling into 10+ tax jurisdictions, (b) you have no full-time finance staff, (c) the 2–5% fee delta is less than what compliance + finance hires would cost. Many SaaS companies use MoR to start, migrate to Stripe-direct after Series A when they can afford a finance team. Speclyy can do the reverse — Stripe-direct now, evaluate MoR migration at Stage 3.

### Sample Stage-3 stack (recommended starting position)

```
Billing rail:        Stripe-direct (no migration)
Tax compliance:      Anrok or Sphere (depending on US-vs-Canada revenue mix)
Filing cadence:      Anrok auto-files US states; CPA files Canadian + EU
CPA engagement:      Quarterly review, year-end close, occasional ad-hoc
EU/UK:               OSS registration (if EU revenue ≥ €10k)
```

---

## Stage 4 — Mature ($2M+ ARR)

**The goal: this is no longer a side concern.**

By here, you have:

- Either (a) a finance person/team owning compliance directly, or (b) the MoR shouldering it.
- A relationship with international tax counsel for any cross-border M&A or restructuring questions.
- Annual reviews of your tax posture as part of board reporting.

This page stops being relevant. Your finance lead writes the next version.

The one thing that **doesn't** change at Stage 4: the W-8BEN-E renewal cadence (every 3 years). Calendar that immortally.

---

## The MoR escape hatch — when to take it

The TL;DR for Speclyy: **don't take it now**, but know it exists.

A Merchant of Record removes ~90% of cross-border tax complexity in exchange for ~3% of GMV. The right time is **when the cost of compliance (tooling + CPA + ops time) exceeds the MoR fee delta**. Rough math:

```
At $200k ARR:
  - DIY compliance cost: ~$3k–$8k/yr (CPA + tooling + your time)
  - MoR cost (5% of $200k): $10k/yr
  → DIY wins.

At $1M ARR:
  - DIY compliance cost: ~$15k–$30k/yr (more states, more registrations,
    more filing time, possible part-time finance hire)
  - MoR cost (5% of $1M): $50k/yr
  → DIY still wins, *if* you have the finance ops.

At $5M ARR with 8+ US states + EU + UK + APAC:
  - DIY compliance cost: $80k–$150k/yr (full-time finance + tooling + counsel)
  - MoR cost (5% of $5M): $250k/yr
  → Closer call. Depends on whether you have a finance team or want one.
```

Notice the crossover never quite happens cleanly — MoR is mostly bought for **simplicity**, not cost. Founders who don't want to think about tax compliance pay the MoR premium gladly. Founders who already have finance ops keep the spread.

For Speclyy, the answer for now is **Stripe-direct + Stripe Tax + reactive registration**. Revisit when you're approaching Stage 3.

---

## Signals that you're graduating to the next stage

| You're in… | …and you should think about graduating when… |
|---|---|
| Stage 1 | First non-Alberta Canadian customer signs up; or any single US state shows >$50k revenue in trailing 12mo; or ARR crosses $30k. |
| Stage 2 | You're managing 4+ active tax registrations; OR you're spending >2 hours/month on tax operations; OR your CPA's hours are creeping past 10/quarter. |
| Stage 3 | You have 8+ tax registrations; OR you're hiring a full-time finance person; OR EU/UK revenue is >25% of total. |
| Stage 4 | You're not reading this doc anymore. |

---

## Reading list (stage-appropriate)

**Stage 1 only:**
- [`tax-canada.md`](tax-canada.md) § GST/HST registration — the one form you must file.
- [`tax-us.md`](tax-us.md) § W-8BEN-E — the other one form you must file.

**Stage 2:**
- [`tax-canada.md`](tax-canada.md) § Provincial registrations.
- [`tax-us.md`](tax-us.md) § US state sales tax + § US EIN.
- [Stripe Tax — Monitoring view](https://stripe.com/docs/tax) — your quarterly checkpoint.

**Stage 3:**
- [Anrok docs](https://docs.anrok.com/) and [Sphere docs](https://docs.getsphere.com/) — evaluate against your revenue mix.
- [Paddle vs. Stripe-direct comparison guides](https://www.paddle.com/resources/paddle-vs-stripe) — read both sides.
- [EU OSS registration guide](https://vat-one-stop-shop.ec.europa.eu/) — when EU revenue matters.

---

## TL;DR for Speclyy today

1. **File W-8BEN-E with Stripe.** Half an hour.
2. **Register for CRA federal GST/HST.** Half an hour.
3. **Turn on `automatic_tax: { enabled: true }`** in the subscription create call. Already in [`../implementation-tasks/billing-subscription/TASK-BILL-09-cad-pricing-expansion.md`](../implementation-tasks/billing-subscription/TASK-BILL-09-cad-pricing-expansion.md).
4. **Calendar a quarterly Stripe Tax review.** 30 minutes/quarter.
5. **Defer everything else** until a customer or threshold triggers it.

That's it. Ship.
