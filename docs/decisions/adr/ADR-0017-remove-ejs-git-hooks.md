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
date: 2026-04-08
deciders: [Engineering Journey System maintainers]
---

# ADR-0017: Remove Git Hooks in Favor of Copilot Hooks

## Agent Rules

- **SHOULD:** Treat this removal decision as historical EJS architecture, not as a decision-graph hook policy.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0017-remove-git-hooks-in-favor-of-copilot-hooks.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

Removing Git hooks simplified setup but left non-Copilot work without
session-recording reminders. This trade-off is now historical; the archive
must not be activated.
