# Jurisdiction & residency

Where Speclyy operates, the tax-residency posture this implies, and what would change it.

---

## The current setup

| | |
|---|---|
| **Headquarters** | Calgary, Alberta, Canada |
| **Tax residency** | Canadian-resident (Alberta) |
| **Operating model** | Fully remote-from-Canada; no offices anywhere |
| **Infrastructure** | Vercel (edge, multi-region), Supabase (single project — see [ADR-0021](../architecture/adr/0021-single-supabase-project.md)). No on-prem, no leased servers. |
| **Workforce location** | Canada-only at present |
| **Customer locations** | Global. Initial focus US + Canada (see [`../architecture/billing.md`](../architecture/billing.md)). |

> **TBD — fill in once incorporation is finalized:**
> - Legal entity name
> - Incorporation type (Alberta provincial corporation / federal corporation / sole proprietorship)
> - CRA Business Number (BN)
> - Date of incorporation

## Why this combination matters

Two facts about Speclyy together determine ~90% of our tax obligations:

1. **Canadian-resident** — we owe Canadian corporate income tax on worldwide profit, and we collect Canadian sales tax (GST/HST + applicable provincial) per the customer's province.
2. **No fixed place of business outside Canada** — we have no Permanent Establishment in the US (or anywhere else), which means treaty protection applies cleanly.

The first determines our domestic compliance ([`tax-canada.md`](tax-canada.md)). The second determines our cross-border posture ([`tax-us.md`](tax-us.md)).

---

## Permanent Establishment ("PE") — the concept that protects us from US federal income tax

Under Article V of the [Canada–United States Tax Treaty](https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/country/united-states-america-convention-consolidated-1980-1983-1984-1995-1997-2007.html), a Canadian business owes US federal income tax **only** on profits attributable to a Permanent Establishment in the US. No PE → no US federal income tax on US-source revenue. Speclyy currently has no PE.

### What does NOT create a PE

| Activity | Reason |
|---|---|
| Selling SaaS to US customers from Canada | The treaty's "fixed place of business" definition requires physical presence Speclyy controls. |
| Hosting on Vercel / Supabase | Cloud providers' infra is theirs, not ours. We rent capacity, we don't operate a facility. |
| Visiting US customers occasionally for sales calls | Below the dependent-agent thresholds. |
| Banking with a US-domiciled bank account | Custodial relationships don't create PE. |
| Collecting US state sales tax | A registration obligation, not a PE. |

### What DOES create a PE (avoid or get advice first)

| Activity | Triggers PE? |
|---|---|
| Renting an office / co-working space in the US (sustained) | **Yes** |
| Hiring a full-time US-resident employee in a sales/operations role | **Probably** — depends on dependent-agent rules |
| Storing inventory in a US warehouse | **Yes** (less relevant for SaaS) |
| Sending Canadian employees to the US for >183 cumulative days/year | **Yes** |
| Incorporating a US subsidiary | The subsidiary itself is a PE — different tax stack |
| Long-term contractor based in the US who exclusively serves Speclyy | **Maybe** — facts-and-circumstances |

> ⚠️ **If you ever consider any of the above** — including hiring a US-based contractor for a meaningful, ongoing role — **talk to a cross-border accountant before signing**. The treaty's "dependent agent" provisions can create a PE retroactively, generating US tax obligations going back to whenever the relationship started.

---

## State-level economic nexus (separate from PE)

US **state** sales-tax obligations are a separate concept from federal PE. Even with no PE, you can owe sales tax in a state once you cross its **economic nexus threshold** (post-*South Dakota v. Wayfair*, 2018).

- Typical threshold: **$100k revenue or 200 transactions per year, per state.**
- ~24 US states tax SaaS; ~19 don't.
- See [`tax-us.md`](tax-us.md) § "State sales tax" for the playbook.

State income tax is rare for foreign sellers without PE, but a few states (notably California's franchise tax) have separate hooks. Defer worrying about state income tax until your accountant flags it.

---

## What would change the residency story

| Change | Implication |
|---|---|
| Open a US subsidiary | Whole new tax stack — US federal corporate tax, state corporate tax in HQ state, transfer-pricing studies between Canadian parent and US sub. Don't do this casually. |
| Founder relocates to the US | Personal tax residency change is *separate* from corporate residency, but if the founder is also the day-to-day decision-maker, CRA may consider whether the corporation is still resident in Canada (place-of-management test). |
| Hire a US-resident employee | Triggers PE consideration + US payroll tax + state withholding + state-by-state employment-law compliance. Do this through an Employer of Record (e.g. Deel, Remote.com) if at all. |
| Move HQ from Alberta to another province | No federal change, but provincial corporate tax rate changes. Alberta has the lowest combined rate in Canada — moving anywhere else costs us. |
| Cross CA$30k worldwide taxable revenue | Mandatory GST/HST registration triggered (see [`tax-canada.md`](tax-canada.md)). |
| Cross any US state's economic-nexus threshold | Mandatory state sales-tax registration in that state (see [`tax-us.md`](tax-us.md)). |

---

## Quick decision tree

When evaluating "is this thing OK to do without a tax advisor?", check:

1. **Is it cloud / customer-facing only?** ✅ Probably fine.
2. **Does it involve a person, office, or thing physically in the US?** ⚠️ Stop and ask a cross-border accountant.
3. **Does it cross a revenue or transaction threshold?** ⚠️ Stop and check the threshold tables in [`tax-canada.md`](tax-canada.md) and [`tax-us.md`](tax-us.md).

If unsure, ask. Cross-border tax remediation is 10–100× more expensive than upfront compliance.
