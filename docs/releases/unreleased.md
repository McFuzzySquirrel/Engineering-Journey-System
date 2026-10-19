# decision-graph — Unreleased

- **Package manifest version:** `0.1.0`
- **Release date:** Not released; npm publication is pending.

## Summary

The initial decision-graph CLI, server, and read-only browser explorer are
implemented and available for local installation and validation. This is a
pre-release summary, not a claim that version `0.1.0` has been published.

## Highlights

- Create, import, and synchronize hybrid MADR ADRs and SDRs.
- Retrieve file-scoped rules, search records, inspect graph relationships,
  lint decisions, and run verification checks.
- Compile accepted rules into a managed `AGENTS.md` block.
- Use MCP over stdio or streamable HTTP.
- Serve multiple projects with SQLite or PostgreSQL storage and synchronize
  records with push and read-only pull workflows.
- Browse and search indexed records across projects in the Workbench UI,
  inspect provenance and relationships, and read sanitized Markdown.
- Use server-side project/type/status/tag facets with globally ranked text
  search and title-sorted empty-query browsing.
- See the [ADR index](../decisions/README.md) for architectural decisions
  and migrated EJS history, including the decisions behind the local UI.

## Compatibility and Prerequisites

- Node.js 26 or newer is required.
- SQLite uses `better-sqlite3`, a native module with prebuilt binaries for
  common platforms.
- PostgreSQL is needed only for a PostgreSQL-backed server or its optional
  integration tests.
- No migration from an existing EJS database is provided. Existing ADRs can
  be imported; review heuristic conversion drafts before accepting them.

## Installation or Upgrade

The package is not published to npm. Build from a checkout with `npm ci` and
`npm run build`, or create a local package with `npm pack` and install the
resulting `decision-graph-0.1.0.tgz` tarball. See the
[user guide](../user-guide.md) and [administrator guide](../admin-guide.md).

## Known Limitations

- The HTTP server has no authentication in v1. Keep it on localhost or a
  trusted network.
- WCAG 2.2 AA is the UI target, but a full conformance audit has not been
  completed; the target is not a conformance claim.
- `dg import --convert` uses heuristics and always creates proposed drafts
  that require human review.
- `dg push` upserts records and edges but does not remove server records
  missing from the local project.
- `dg pull` stores remote data in a separate local namespace and does not write
  into repository decision files.
- PostgreSQL integration coverage runs only when `DG_TEST_PG_URL` is set.
- No npm release or published upgrade path is available yet.

## Validation

On Node.js 26.12.0, the test suite reported 43 passing tests and one skipped
optional PostgreSQL integration test. Lint, formatting, typecheck, build,
`dg lint`, and `dg verify` passed. A package dry run included the built UI
assets. A local production-server smoke test served the UI, its JavaScript
and CSS assets, and the projects API; a headless-browser smoke check also
verified record rendering and 320 CSS pixel reflow. A locally packed `0.1.0`
tarball was installed in a temporary fixture; initialization, MADR indexing,
`dg context`, and `AGENTS.md` generation passed. No full WCAG audit, live
hosted MCP client, PostgreSQL integration run, or public npm release was
validated as part of this pre-release check.

## Security and Privacy

Local CLI and stdio MCP workflows access files and the SQLite index in the
selected project. Push transmits indexed records and project metadata to the
configured server. Pull imports server records into a separate namespace.
The browser UI renders record Markdown with raw HTML disabled and sanitizes
the result; embedded images and active media are not loaded, and external
links open with protected new-tab attributes. The server does not
authenticate requests in v1; operators are responsible for network
restrictions and any TLS termination.

## Documentation

- [User guide](../user-guide.md)
- [Administrator guide](../admin-guide.md)
- [MCP client configuration](../mcp.md)
- [Architecture decision records](../decisions/README.md)
- [Changelog](../../CHANGELOG.md)
