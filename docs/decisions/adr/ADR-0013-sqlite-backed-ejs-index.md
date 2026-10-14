---
id: ADR-0013
type: adr
title: SQLite-Backed EJS Index for Agent Reference
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, sqlite, search]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0013: SQLite-Backed EJS Index for Agent Reference

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-03-02)

**Technical Story:** Historical EJS indexing decision, migrated during
decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md).

## Agent Rules

- **MUST NOT:** Use the archived EJS database or CLI as decision-graph's record index.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0013') || !fs.existsSync('legacy/ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes the EJS index implementation, whose source remains archived.

## Context and Problem Statement

Reading every ADR and session journey consumed substantial agent context.
EJS needed targeted lookup for metadata and full-text search.

## Decision Drivers

- Retrieve selected records without loading the full corpus.
- Search record content efficiently.
- Keep Markdown as the canonical source and allow safe re-indexing.

## Considered Options

- Read all Markdown files for each query.
- Generate a flat JSON index.
- Index Markdown in SQLite with FTS5.

## Decision Outcome

The historical EJS decision selected a Python SQLite/FTS5 index with
upsert-based synchronization. Decision-graph continues the broader idea of a
rebuildable index but replaces the EJS database and tooling with a typed Store
contract and current ADR/SDR records. ADR-0001 supersedes the EJS-specific
implementation.

## Positive Consequences

Targeted FTS lookup reduced the context needed to find ADRs and journeys.

## Negative Consequences

The index required synchronization and remained a generated artifact; its
implementation also depended on Python and PyYAML. ADR-0001 replaces the EJS
database and tooling with decision-graph's own index.

## Pros and Cons of the Options

### Read all Markdown files

- Good, because it required no index or extra runtime dependency.
- Bad, because every lookup loaded more context and offered no full-text query.

### JSON flat-file index

- Good, because it was a simple machine-readable format.
- Bad, because it lacked full-text search and still required broad reads.

### SQLite with FTS5

- Good, because it enabled compact targeted lookup and full-text search.
- Bad, because it required synchronization and a generated database.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md)
