# Changelog

All notable changes to decision-graph are documented here, following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package manifest
reports `0.1.0`; that version has not been published to npm. The `ejs-final`
tag marks the prior EJS project state, not a decision-graph release.
See the [unreleased notes](docs/releases/unreleased.md) for current
compatibility, validation, and known limitations.

## [Unreleased]

### Added

- CLI commands for project initialization, record import and synchronization,
  ADR drafts, SDR capture and promotion, search, context, verification, lint,
  and graph export.
- Hybrid MADR records with scoped rules and verification checks, plus import
  support for MADR, Nygard/adr-tools, and agent-optimized records.
- SQLite/FTS5 local indexing, a shared Store contract, and optional
  PostgreSQL-backed multi-project serving.
- MCP tools over stdio and streamable HTTP, plus remote push and read-only
  pull workflows.
- A read-only Workbench browser UI served from `dg serve`, with cross-project
  search, facets, record provenance, and relationship navigation.
- Vite-based UI development and production asset packaging; behavioral tests
  for safe Markdown rendering.
- Generated `AGENTS.md` guidance and documentation for users, administrators,
  architecture decisions, and the unreleased package.

### Changed

- Replaced the active EJS session-recording direction with decision-graph.
  Historical EJS ADRs remain archived and are marked deprecated in the
  decision-graph ADR index.
- Search now supports server-side project, type, status, and tag filters;
  values within a facet use OR, facets combine with AND, text results rank
  across selected projects, and empty-query browsing sorts by title.

### Security

- The browser UI disables raw Markdown HTML, sanitizes rendered content,
  forbids remote embedded media, protects external links, and uses a
  restrictive content security policy.
- The v1 server has no authentication. It binds to localhost by default and
  warns on non-local binds; operators must restrict network access.

## Release status

The first npm release is planned as version `0.1.0`. Registry publication is
still a manual step and has not occurred.
