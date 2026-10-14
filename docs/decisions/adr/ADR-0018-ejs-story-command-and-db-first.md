---
id: ADR-0018
type: adr
title: Story Command and DB-First Reinforcement
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, search, markdown]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0018: Story Command and DB-First Reinforcement

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-04-09)

**Technical Story:** Historical EJS query and format decision, migrated
during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0018-story-command-and-db-first-reinforcement.md).

## Agent Rules

- **MUST NOT:** Use the archived EJS `story` command as a decision-graph interface.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0018') || !fs.existsSync('legacy/ejs-docs/adr/0018-story-command-and-db-first-reinforcement.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes the EJS query policy, and its source remains archived.

## Context and Problem Statement

EJS already had a SQLite index, but agents sometimes read raw journey files
instead of querying it. A JSON migration was proposed as a possible efficiency
improvement.

## Decision Drivers

- Reduce context consumed when agents look up session history.
- Keep the human-readable Markdown source.
- Make the preferred database-first query concrete and useful.

## Considered Options

- Convert journeys to JSON.
- Keep Markdown and add a richer database query command.
- Keep the existing summary command unchanged.

## Decision Outcome

The historical EJS decision rejected JSON and added a richer `story` query,
promoting database lookup before raw-file reads. ADR-0001 supersedes the EJS
tooling; decision-graph keeps Markdown records as source and uses its own
SQLite index.

## Positive Consequences

The richer query offered compact narrative history while retaining
human-readable Markdown.

## Negative Consequences

The extra command used heuristic extraction and overlapped with existing
summary behavior. ADR-0001 replaces the EJS-specific query interface.

## Pros and Cons of the Options

### Convert journey files to JSON

- Good, because a machine-oriented format could simplify parsing.
- Bad, because JSON added encoding overhead and weakened Markdown readability.

### Keep Markdown and add a richer database query

- Good, because it improved the database-first workflow without changing the
  source format.
- Bad, because it added a query command and heuristic extraction logic.

### Keep Markdown and make no changes

- Good, because it avoided implementation and migration work.
- Bad, because the existing summary was too limited and raw-file reads
  continued to consume context.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0018-story-command-and-db-first-reinforcement.md)
