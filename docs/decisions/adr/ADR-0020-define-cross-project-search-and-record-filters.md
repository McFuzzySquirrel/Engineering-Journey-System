---
id: ADR-0020
type: adr
title: Define cross-project search and record filters
status: accepted
applies_to:
  - src/server/http.ts
  - src/store/store.ts
  - src/store/sqlite.ts
  - src/store/postgres.ts
  - src/ui/**
tags: [search, filters, server]
supersedes: []
relates_to: []
derived_from:
  - SDR-20261014-011
date: 2026-10-15
deciders: [McFuzzySquirrel]
---

# ADR-0020: Define cross-project search and record filters

- **Deciders:** McFuzzySquirrel
- **Date:** 2026-10-15

**Technical Story:** [Define cross-project search and record filters (#42)](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/42)

## Agent Rules

- **MUST:** Search all configured projects by default, while allowing users to scope results to selected projects.
- **MUST:** Apply project, record type, status, and tag filters in the store/API rather than downloading complete project graphs for client-side filtering.
- **MUST:** Combine different facets with AND and multiple values within one facet with OR.
- **MUST:** Match all query terms across titles and Markdown bodies; rank text-search results by relevance.
- **MUST:** Return title-ascending browse results when the query is empty, and include project and record IDs to disambiguate cross-project results.

## Verify

- **Check:** npm test -- --run test/store.test.ts test/remote.test.ts test/postgres.test.ts
- **Expected:** Tests cover facet combination, multi-project ranking, empty-query ordering, and backend filter behavior; PostgreSQL integration may be skipped unless `DG_TEST_PG_URL` is configured.

## Context and Problem Statement

The server stores records from multiple projects, while the explorer needs one predictable result set with project, type, status, and tag filters. Should the browser fetch whole graphs and filter locally, or should the API produce the globally filtered and ordered result set?

## Decision Drivers

- Preserve the existing all-query-terms full-text matching behavior.
- Keep result ranking comparable across projects.
- Avoid transferring complete project graphs to the browser.
- Make combined filter behavior predictable.
- Disambiguate records that share identifiers across projects.

## Considered Options

- **Search and filter across projects in one server/store query.**
- **Fetch project graphs and apply filters in the browser.**
- **Merge independently ranked per-project searches or sort all results alphabetically.**

## Decision Outcome

Chosen option: search and filter across the selected projects in one server/store query. Text queries preserve all-term matching and global relevance ranking; empty-query browsing sorts by title ascending. Project, type, status, and tag values are repeated query parameters.

### Positive Consequences

- Search ranking is calculated over the selected project set rather than concatenated from per-project rankings.
- Large project graphs do not need to be downloaded before filtering.
- Facet behavior is consistent across the browser and HTTP API.
- Project and record IDs distinguish results with otherwise identical identifiers.

### Negative Consequences

- SQLite and PostgreSQL implementations must preserve the same filter and ordering contract.
- The client must encode repeated facet values and refresh available facets when project selection changes.
- Relevance ordering is intentionally different from title ordering used for empty-query browsing.

## Pros and Cons of the Options

### One server/store query across selected projects

- Good, because it provides globally ranked results and server-side filtering.
- Good, because the browser receives only matching records.
- Bad, because both store backends must implement the same multi-value semantics.

### Client-side filtering of project graphs

- Good, because it can reuse a basic list endpoint.
- Bad, because it transfers unnecessary records and makes large projects expensive to browse.

### Merge project-local rankings or alphabetize all results

- Good, because per-project search can be implemented independently.
- Bad, because merging local rankings does not produce one global relevance order; alphabetizing text matches discards relevance.

## Links

- [Implementation issue #46](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/46)
- Derived from [SDR-20261014-011](../sdr/SDR-20261014-011-define-cross-project-search-and-record-filters.md)
- Implemented by `src/server/http.ts`, `src/store/`, and `src/ui/main.ts`
- Tests: `test/store.test.ts`, `test/remote.test.ts`, and `test/postgres.test.ts`
