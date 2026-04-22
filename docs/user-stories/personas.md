# Personas

Single source of truth for the user types referenced in user stories. Each story's frontmatter sets `persona:` to one of the keys below.

Do not duplicate persona descriptions inside individual stories. If a story needs more nuance, add a one-line note in its **Context** section instead.

---

## Designer (`designer`) — primary

**Who they are**
Freelance interior designer or principal at a 1–10 person studio. Based in Los Angeles, New York, Dallas, or Calgary (the four MVP markets — see [`mvp-decisions.md`](../mvp-decisions.md) § 3). Focus on high-end residential renovations: kitchens, powder rooms, primary ensuites.

**Their workflow today**
Specs are assembled by hand in Google Docs, Word, or generic templates inherited from previous projects. Product details are copy-pasted from vendor pages. Inconsistent fields (sometimes SKU, sometimes finish, sometimes neither) cause rework with builders, trades, and clients.

**What they want from Speclyy**
- Capture a product from a vendor URL in seconds, not minutes.
- Have a structured grid of all spec'd products, not paragraphs of text.
- Hand a client or trade a single PDF that looks intentional and is unambiguous.
- Never lose an item to a stale link or a lost browser tab.

**What they don't want**
- A second password to remember.
- A taxonomy that doesn't match how *they* organize a project.
- A tool that gates them out of writing specs because they haven't paid yet.

**Where they appear in the stories**
~90% of MVP stories. Designer is the assumed persona unless a story says otherwise.

---

## Prospect (`prospect`) — pre-sign-in

**Who they are**
Unauthenticated visitor on `speclyy.com` (the marketing site, [`apps/marketing`](../../apps/marketing)) or the sign-in page. Has not yet signed in with Google. May be evaluating Speclyy from a referral, an ad, or a recommendation in a designer community.

**Their workflow today**
Researching alternatives to ad-hoc spec sheets. Likely also looking at Programa, Gather, Studio Designer, or DIY Notion / Airtable templates.

**What they want from Speclyy**
- Understand quickly what Speclyy is and isn't.
- See pricing without having to sign up.
- Try the app without committing payment.

**Where they appear in the stories**
Marketing-site stories are out of scope for this folder. The Prospect persona is referenced only by [`US-101`](epic-01-auth-onboarding/US-101-sign-in-with-google.md) — the moment a prospect crosses into being a Designer.

---

## Admin / Curator (`admin`) — internal Speclyy team

**Who they are**
Internal Speclyy operator (founder / contractor) responsible for keeping the global product library accurate: adding new brands, approving auto-promoted URLs, fixing scrape errors, removing duplicates.

**Their workflow today (MVP)**
**No dedicated UI.** All curation happens via:
- Direct Drizzle queries against the Supabase database (service-role).
- Manual triggers of the Inngest bulk-crawl job (see [`../architecture/adr/0013-bulk-crawl.md`](../architecture/adr/0013-bulk-crawl.md)).
- Querying Axiom for failed scrapes (see [`../architecture/adr/0014-log-store.md`](../architecture/adr/0014-log-store.md)).

These ops procedures are documented in the relevant epic READMEs (notably [`epic-04-url-prefill-scraper/README.md`](epic-04-url-prefill-scraper/README.md)) — not as user stories, because there is no UI to test against.

**Where they appear in the stories**
Not in MVP. The first admin UI ships in MVP+1 (see [`../roadmap.md`](../roadmap.md) — "Global product library approval UI"). This persona is listed here so that future stories can reference it without redefining it.
