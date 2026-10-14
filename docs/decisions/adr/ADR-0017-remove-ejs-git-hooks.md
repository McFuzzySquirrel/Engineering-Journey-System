---
id: ADR-0017
type: adr
title: Remove Git Hooks in Favor of Copilot Hooks
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, hooks]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0017: Remove Git Hooks in Favor of Copilot Hooks

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-04-08)

**Technical Story:** Historical EJS Git-hook removal decision, migrated
during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0017-remove-git-hooks-in-favor-of-copilot-hooks.md).

## Agent Rules

- **MUST NOT:** Reintroduce archived EJS Git hooks as decision-graph automation.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0017') || !fs.existsSync('legacy/ejs-docs/adr/0017-remove-git-hooks-in-favor-of-copilot-hooks.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this EJS hook decision, and its source remains archived.

## Context and Problem Statement

EJS contained manually installed Git hooks as well as Copilot hooks. Once
Copilot hooks provided lifecycle guarantees, the Git hooks appeared
duplicative.

## Decision Drivers

- Remove unnecessary manual installation steps.
- Keep the workflow aligned with EJS's Copilot scope.
- Avoid redundant automation and confusing boundaries.

## Considered Options

- Keep Git hooks as a backup.
- Remove Git hooks.
- Make Git hooks conditional on Copilot session state.

## Decision Outcome

The historical EJS decision removed its Git hooks and installer scripts,
relying on Copilot hooks for structural session automation. ADR-0001
supersedes both hook systems for active decision-graph work.

## Positive Consequences

Removing Git hooks reduced installation friction and avoided duplicated
session-recording automation.

## Negative Consequences

Non-Copilot workflows no longer received EJS session reminders. ADR-0001
retires both EJS hook systems from active decision-graph work.

## Pros and Cons of the Options

### Keep Git hooks as a safety net

- Good, because they could remind contributors who were not using Copilot.
- Bad, because they duplicated automation and required manual installation.

### Remove Git hooks

- Good, because the EJS stack had fewer files and setup steps.
- Bad, because CLI-only EJS workflows had no reminder mechanism.

### Make Git hooks Copilot-aware

- Good, because checks could have been limited to active EJS sessions.
- Bad, because marker checks added complexity for little benefit.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0017-remove-git-hooks-in-favor-of-copilot-hooks.md)
