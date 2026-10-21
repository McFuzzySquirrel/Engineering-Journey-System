# Changelog

All notable changes to decision-graph are documented here, following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package manifest
reports `0.1.0`; that version has not been published to npm. The `ejs-final`
tag marks the prior EJS project state, not a decision-graph release.

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
- Generated `AGENTS.md` guidance and documentation for users, administrators,
  architecture decisions, and the unreleased package.
- Legacy ADR import support for short-numbered filenames, spaced headings such
  as `ADR 001`, and inline `**Status:**`, `**Date:**`, and `**Tags:**` metadata.
- Provisioned agent skill at `.agents/skills/decision-graph` (also available
  for OpenCode and Claude directories) with migration and lint-triage guidance.
- `dg lint` reports `id-mismatch` warnings when a record ID disagrees with its
  filename or heading number.

### Changed

- `dg init` resumes against an existing configuration instead of failing, can
  adopt a detected legacy ADR directory, and reports unparseable records
  without aborting. `dg sync` and `dg import` retain the last indexed version
  of a file that fails to parse and exit non-zero after indexing the rest.
- Upgraded `better-sqlite3` to 13.x, which uses N-API prebuilds and removes the
  deprecated `prebuild-install` dependency.
- Replaced `gray-matter` with direct `js-yaml` frontmatter parsing, removing
  the vulnerable `js-yaml@3`/`argparse@1`/`sprintf-js` chain from consumer
  installs and the root `js-yaml` override.

- Replaced the active EJS session-recording direction with decision-graph.
  Historical EJS ADRs remain archived and are marked deprecated in the
  decision-graph ADR index.

### Security

- The v1 server has no authentication. It binds to localhost by default and
  warns on non-local binds; operators must restrict network access.

## Release status

The first npm release is planned as version `0.1.0`. Registry publication is
still a manual step and has not occurred.
