# User Stories

Implementation-level user stories for the Speclyy MVP. One story = one shippable slice with acceptance criteria a developer can hand to QA.

Stories live alongside — and link directly to — the architecture decisions in [`../architecture/adr/`](../architecture/adr/), the screens in [`../screen-inventory.md`](../screen-inventory.md), and the flows in [`../user-flows.md`](../user-flows.md). They translate "what we will build" into "what done looks like."

## Format

- One story per file, named `US-EOO-<kebab-slug>.md` (see "Naming" below).
- See [`TEMPLATE.md`](TEMPLATE.md) for the canonical structure.
- Stories use Connextra narrative + Gherkin acceptance criteria — the pairing recommended by Cohn / Adzic. Narrative tells *why*, Gherkin tells *exactly when done*.
- Personas are defined once in [`personas.md`](personas.md) and referenced by name from each story's frontmatter.
- Architecture decisions are cited by ADR ID (e.g. `ADR-0005`); screens by section ID (e.g. `4.1`).

## Status legend

| Symbol | Status         | Meaning                                       |
|--------|----------------|-----------------------------------------------|
| 🔲     | `draft`        | Captured, not yet refined                     |
| 🔜     | `ready`        | Refined, AC agreed, dev can pick up           |
| ⚙      | `in-progress`  | Branch open or in PR                          |
| ✅     | `done`         | Merged + verified in staging                  |
| 🚧     | `blocked`      | Waiting on dependency                         |

Status lives in each story's frontmatter and in the epic README story tables. The legend matches the emoji conventions used in [`../roadmap.md`](../roadmap.md).

## Epics

| #  | Epic                                                           | Stories | Status |
|----|----------------------------------------------------------------|---------|--------|
| 1  | [Authentication & Onboarding](epic-01-auth-onboarding/)         | 7       | 🔜     |
| 2  | [Project Management](epic-02-project-management/)               | 6       | 🔲     |
| 3  | [Product Search & Discovery](epic-03-product-search/)           | 5       | 🔲     |
| 4  | [URL Prefill / Scraper UX](epic-04-url-prefill-scraper/)        | 6       | 🔲     |
| 5  | [Manual Entry & Item Form](epic-05-manual-entry-item-form/)     | 7       | 🔲     |
| 6  | [Completeness & Status Tracking](epic-06-completeness-status/)  | 5       | 🔲     |
| 7  | [PDF Export](epic-07-pdf-export/)                               | 6       | 🔲     |
| 8  | [Billing & Subscription](epic-08-billing-subscription/)         | 5       | 🔲     |
| 9  | [Account Settings](epic-09-account-settings/)                   | 4       | 🔲     |
|    | **Total**                                                      | **~51** |        |

> **First-pass scope:** Only Epic 1 has its individual story files written. Epics 2–9 currently expose epic READMEs with planned story tables; story files will be written in a follow-up pass once the format is validated against real implementation.

## Out of scope

The following are intentionally **not** captured as user stories in this folder:

- **MVP+1 features** — My Library, CSV export, studio branding, admin approval UI. Tracked in [`../roadmap.md`](../roadmap.md) until promoted into the MVP.
- **Marketing site** — `apps/marketing` is content + conversion work, not feature work. Stays in its own backlog.
- **Admin / curator UI** — MVP+1. For MVP, ops happens via Drizzle service-role queries; documented in epic-04's README only.

## Naming

- **Story ID:** `US-EOO` where `E` = epic number (1–9), `OO` = zero-padded sequence within the epic.
  - `US-101` = epic 1, story 01.
  - `US-405` = epic 4, story 05.
- **Filename:** `<ID>-<kebab-slug>.md`. Slug is the imperative action, ≤5 words.
- **Branch convention:** `us-EOO-<slug>` so `git log` ties commits back to the story.

## Adding a new story

1. Pick the epic folder. Find the next free `US-EOO` for that epic.
2. Copy [`TEMPLATE.md`](TEMPLATE.md) to `epic-XX-.../US-EOO-<slug>.md`.
3. Fill the frontmatter and all sections. Link `screen-inventory` sections and ADR IDs explicitly — every story should be self-contained enough that a developer can start without opening other files.
4. Add a row to that epic's `README.md` story table.
5. Open a PR titled `docs(stories): add US-EOO <title>`.

## Conventions

- **Don't reuse retired IDs.** If a story is retired, mark it `status: superseded` with a `superseded_by:` field — same convention as ADRs.
- **Don't shift IDs.** Append (`US-108`, `US-208`) when an epic grows.
- **Out-of-scope items get linked to [`../roadmap.md`](../roadmap.md)**, not buried inside a story.
- **Acceptance criteria are testable.** Every Gherkin scenario should map to at least one entry in the story's Test plan section.
- **Source of truth wins on conflicts.** If a story and an ADR disagree, fix the story; if a story and `mvp-decisions.md` disagree, fix the story. Cite the source.
