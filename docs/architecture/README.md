# Architecture

Technical architecture for Speclyy — decisions, high-level design, and diagrams.

## Structure

```
docs/architecture/
├── README.md        — this file (overview + index)
├── adr/             — Architecture Decision Records (numbered, immutable once Accepted)
├── diagrams/        — system diagrams, sequence diagrams, data model (add as created)
└── *.md             — narrative architecture docs (add as written)
```

## What lives where

- **ADRs** capture a single decision: context, options, chosen path, tradeoffs. Immutable once **Accepted** — superseded by a new ADR when the decision changes. See [adr/README.md](adr/README.md) for the index and process.
- **Narrative docs** (e.g. `auth.md`, `database.md`, `scraper.md`) describe *how* a component works end-to-end — the current state, not a historical decision. These get updated in place as the system evolves.
- **Diagrams** live under `diagrams/`. Prefer Mermaid (renders in GitHub) or committed SVG/PNG with the source file alongside.

## Quick index

### Decisions (ADRs)
See [adr/README.md](adr/README.md).

### Narrative docs
*(none yet — added as components are designed)*

### Diagrams
*(none yet — added as components are designed)*
