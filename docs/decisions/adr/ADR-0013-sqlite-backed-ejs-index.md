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
date: 2026-03-02
deciders: [Engineering Journey System maintainers]
---

# ADR-0013: SQLite-Backed EJS Index for Agent Reference

## Agent Rules

- **SHOULD:** Treat the archived EJS database as a historical implementation; decision-graph uses its own rebuildable record index.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

Targeted lookup reduced context use but required synchronization, and the
database remained a generated artifact. The EJS implementation is preserved
under `legacy/`.
