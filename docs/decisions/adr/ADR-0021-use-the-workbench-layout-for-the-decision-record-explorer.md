---
id: ADR-0021
type: adr
title: Use the Workbench layout for the decision-record explorer
status: accepted
applies_to:
  - src/ui/**
tags: [ui, navigation]
supersedes: []
relates_to: []
derived_from:
  - SDR-20261014-012
date: 2026-10-15
deciders: [McFuzzySquirrel]
---

# ADR-0021: Use the Workbench layout for the decision-record explorer

- **Deciders:** McFuzzySquirrel
- **Date:** 2026-10-15

**Technical Story:** [Prototype the decision-record explorer (#43)](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/43)

## Agent Rules

- **MUST:** Keep project and filter controls, search results, and the selected record inspector available as one browsing experience.
- **MUST:** Provide relationship navigation from the inspector without replacing the result list.
- **SHOULD:** Reflow the desktop panes for narrow viewports instead of requiring horizontal page scrolling.

## Verify

- **Check:** Manual review: run npm run build, start dg serve, open the explorer, select a result, follow a relationship, and repeat at 320 CSS pixels.
- **Expected:** Project/filter context and result browsing remain usable while the inspector updates; the narrow layout has no horizontal page scrolling.

## Context and Problem Statement

Contributors need to search across projects, keep filters available, inspect record details, and follow relationships. Which layout keeps those tasks in context without turning the explorer into a graph canvas or a status board?

## Decision Drivers

- Keep project scope and filters visible during browsing.
- Preserve the result list while inspecting a record and its relationships.
- Support records of every type and status in one searchable collection.
- Keep the primary experience readable and usable on smaller screens.

## Considered Options

- **Variation A — Workbench:** project/filter rail, searchable result list, and persistent inspector.
- **Variation B — Reading room:** editorial catalog with a dedicated record-reading pane.
- **Variation C — Status board:** records grouped into status lanes with a detail drawer.

## Decision Outcome

Chosen option: variation A, the Workbench. Its project/filter rail, searchable result list, and persistent inspector retain the browsing context while exposing record details and relationships.

### Positive Consequences

- Filters and project context remain available while a record is selected.
- Related records can be opened without abandoning the current result collection.
- One layout supports multiple record types and statuses.

### Negative Consequences

- The three-pane desktop layout needs a deliberate narrow-screen reflow.
- The inspector, filters, and result list compete for space on smaller screens.

## Pros and Cons of the Options

### Variation A — Workbench

- Good, because it keeps search, scope, results, and details in one context.
- Bad, because three-pane desktop density requires responsive reflow.

### Variation B — Reading room

- Good, because it gives long-form record content more dedicated space.
- Bad, because the editorial catalog is less suited to dense cross-project filtering.

### Variation C — Status board

- Good, because status groupings are immediately visible.
- Bad, because a lane layout makes status the primary organization even when users search by content or project.

## Links

- [Implementation issue #46](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/46)
- Derived from [SDR-20261014-012](../sdr/SDR-20261014-012-use-the-workbench-layout-for-the-decision-record-explorer.md)
- Prototype decision: [issue #43](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/43)
- Implemented by `src/ui/index.html`, `src/ui/main.ts`, and `src/ui/styles.css`
