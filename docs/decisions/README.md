# Architecture Decision Records

Durable architectural decisions for decision-graph. The native record format
is hybrid MADR: human rationale plus scoped agent rules and verification
checks. The date column records the last review or migration date; historical
EJS decision dates are retained in the corresponding records.

| ADR                                                                                   | Title                                                                | Status                             | Date       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- | ---------- |
| [ADR-0001](adr/ADR-0001-pivot-from-ejs-to-decision-graph.md)                          | Pivot from EJS to decision-graph                                     | Accepted                           | 2026-10-14 |
| [ADR-0010](adr/ADR-0010-engineering-journey-system-adoption.md)                       | Adopt Engineering Journey System for Agent-Assisted Development      | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0011](adr/ADR-0011-continuous-journey-updates.md)                                | Shift EJS to Start-of-Session with Continuous Journey Updates        | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0012](adr/ADR-0012-sub-agent-decision-capture.md)                                | Sub-Agent Decision Capture and Handoff Protocol                      | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0013](adr/ADR-0013-sqlite-backed-ejs-index.md)                                   | SQLite-Backed EJS Index for Agent Reference                          | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0014](adr/ADR-0014-agent-skills-for-ejs-lifecycle.md)                            | Agent Skills for Session Lifecycle Workflows                         | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0015](adr/ADR-0015-ejs-micro-instructions.md)                                    | Micro-Instruction Simplification of EJS Always-On Recording Contract | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0016](adr/ADR-0016-copilot-hooks-for-ejs.md)                                     | Copilot Hooks as Layer 0 Structural Automation                       | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0017](adr/ADR-0017-remove-ejs-git-hooks.md)                                      | Remove Git Hooks in Favor of Copilot Hooks                           | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0018](adr/ADR-0018-ejs-story-command-and-db-first.md)                            | Story Command and DB-First Reinforcement                             | Deprecated; superseded by ADR-0001 | 2026-10-14 |
| [ADR-0019](adr/ADR-0019-serve-the-browser-ui-from-dg-serve.md)                        | Serve the browser UI from dg serve                                   | Accepted                           | 2026-10-15 |
| [ADR-0020](adr/ADR-0020-define-cross-project-search-and-record-filters.md)            | Define cross-project search and record filters                       | Accepted                           | 2026-10-15 |
| [ADR-0021](adr/ADR-0021-use-the-workbench-layout-for-the-decision-record-explorer.md) | Use the Workbench layout for the decision-record explorer            | Accepted                           | 2026-10-15 |
| [ADR-0022](adr/ADR-0022-set-the-local-browser-ui-accessibility-baseline.md)           | Set the local browser UI accessibility baseline                      | Accepted                           | 2026-10-15 |
| [ADR-0023](adr/ADR-0023-render-decision-record-markdown-safely-in-the-browser-ui.md)  | Render decision-record Markdown safely in the browser UI             | Accepted                           | 2026-10-15 |

ADR-0002 through ADR-0009 remain unused; ADR-0010 through ADR-0018 retain
their migrated EJS identifiers for historical references. New records
continue after the highest assigned identifier, so the next available ID is
ADR-0024.
