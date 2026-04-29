# Implementation Tasks

Developer-facing, scoped implementation tasks for the Speclyy MVP. One file = one shippable slice with enough detail to start coding: goal, acceptance criteria, architecture references, review notes, and test plan.

Tasks replace the earlier `user-stories/` + `implementation-plans/` split. The narrative "as a designer, I want …" framing lives in [`../mvp-prd.md`](../mvp-prd.md), [`../user-flows.md`](../user-flows.md), and [`../screen-inventory.md`](../screen-inventory.md). These task files are the *engineering* translation.

> **Greenfield database.** The Supabase project is not yet provisioned. Schema-shaped tasks (TASK-AUTH-02, TASK-BILL-02, etc.) lay down the **initial** schema rather than migrating an existing one. Drizzle records each as a migration file, but there is no live data to consider.

## Groups (epics)

| # | Group | Tasks | Status |
|---|-------|-------|--------|
| 1 | [Auth](auth/) | 8 | ✅ done |
| 2 | [Onboarding](onboarding/) | 6 | 🔜 ready |
| 3 | [Billing & Subscription](billing-subscription/) | 8 | 🔜 ready |
| 4 | [Project Management](project-management/) | — | 🔲 planned |
| 5 | [Product Search & Discovery](product-search/) | — | 🔲 planned |
| 6 | [URL Prefill / Scraper UX](scraper-ux/) | — | 🔲 planned |
| 7 | [Manual Entry & Item Form](item-form/) | — | 🔲 planned |
| 8 | [Completeness & Status](completeness-status/) | — | 🔲 planned |
| 9 | [PDF Export](pdf-export/) | — | 🔲 planned |
| 10 | [Account Settings](account-settings/) | — | 🔲 planned |
| T | [Testing](testing/) | 4 | 🔜 ready |

Groups are filled in order. Only Auth is fleshed out in this pass; later groups land as their dependencies ship.

**Testing is a separate group.** Feature tasks ship with unit tests + manual QA only. End-to-end (Playwright) coverage for a group lands in a dedicated testing task after the group's feature work is merged — see [`testing/README.md`](testing/README.md). This keeps feature PRs unblocked and prevents duplicate harness scaffolding.

## Status legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| 🔲 | planned | Scoped but not refined |
| 🔜 | ready | Refined, AC agreed, dev can pick up |
| ⚙ | in-progress | Branch open or in PR |
| ✅ | done | Merged + verified in staging |
| 🚧 | blocked | Waiting on dependency |

## File format

Each task follows [`TEMPLATE.md`](TEMPLATE.md):

- **Frontmatter** — id, group, status, estimate, dependencies, related ADRs/screens.
- **Goal** — one paragraph: what we're shipping and why.
- **Scope** — bulleted in/out. Prevents scope creep in review.
- **Acceptance criteria** — Gherkin scenarios mapped to testable behavior.
- **Architecture references** — links to ADRs + `architecture/*.md` sections that constrain the implementation.
- **Implementation notes** — routes, tables, schema/DDL, code shape, RLS, env vars.
- **Review notes** — what a reviewer should look for beyond "does it compile": security, auth boundaries, RLS, idempotency, error surfaces.
- **Test plan** — E2E / unit / manual checks.
- **Out of scope** — explicit non-goals to avoid rework.

## Naming

- Task ID: `TASK-<GROUP>-NN` (e.g. `TASK-AUTH-04`).
- Filename: `TASK-<GROUP>-NN-<kebab-slug>.md`.
- Branch: `task-<group>-NN-<slug>`.

## Conventions

- **Cite ADRs by ID** (e.g. `ADR-0005`). Do not paraphrase architecture decisions — link to them.
- **Source of truth wins.** If a task disagrees with an ADR or `architecture/*.md`, fix the task. If it disagrees with `mvp-decisions.md`, fix the task.
- **Don't reuse retired IDs.** Mark superseded tasks `status: superseded` with `superseded_by:`.
- **Acceptance criteria are testable.** Every Gherkin scenario maps to at least one entry in the Test plan.
