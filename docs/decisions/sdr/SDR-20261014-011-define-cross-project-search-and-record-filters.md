---
id: SDR-20261014-011
type: sdr
title: Define cross-project search and record filters
status: promoted
applies_to:
  - src/server/http.ts
  - src/store/store.ts
  - src/store/sqlite.ts
  - src/store/postgres.ts
  - src/ui/**
tags: []
date: '2026-10-14'
promoted_to: ADR-0020
agent: Copilot
---

# SDR-20261014-011: Define cross-project search and record filters

## Decision

Search all configured projects by default and allow project scoping. Expose server-side project, record type, status, and tag filters in the HTTP API; combine different facets with AND and multiple values in one facet with OR. Search titles and Markdown bodies using the current all-query-terms matching and relevance ranking. With an empty query, show the filtered browse list ordered by title ascending; display project and record IDs to disambiguate results.

## Why

This preserves the existing full-text search contract, makes the agreed multi-project and facet behavior explicit, and avoids downloading entire project graphs to filter in the browser.

## Alternatives considered

- Fetch complete project graphs and apply filters only in the client.
- Change search matching or order results alphabetically even when a text query is present.
