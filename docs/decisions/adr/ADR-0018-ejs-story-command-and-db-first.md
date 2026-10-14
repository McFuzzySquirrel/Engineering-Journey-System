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
date: 2026-04-09
deciders: [Engineering Journey System maintainers]
---

# ADR-0018: Story Command and DB-First Reinforcement

## Agent Rules

- **SHOULD:** Treat the EJS `story` command and its lookup policy as historical; use decision-graph commands for active records.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0018-story-command-and-db-first-reinforcement.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

The richer query offered compact history without a format migration, but
introduced another command and heuristic extraction. Its EJS-specific command
and workflow remain in the inactive archive.
