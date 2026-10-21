# decision-graph — Unreleased

- **Package manifest version:** `0.1.0`
- **Release date:** Not released; npm publication is pending.

## Summary

The initial decision-graph CLI and server implementation is ready for local
installation and validation. This is a pre-release summary, not a claim that
version `0.1.0` has been published.

## Highlights

- Create, import, and synchronize hybrid MADR ADRs and SDRs.
- Retrieve file-scoped rules, search records, inspect graph relationships,
  lint decisions, and run verification checks.
- Compile accepted rules into a managed `AGENTS.md` block.
- Use MCP over stdio or streamable HTTP.
- Serve multiple projects with SQLite or PostgreSQL storage and synchronize
  records with push and read-only pull workflows.
- See the [ADR index](../decisions/README.md) for architectural decisions
  and migrated EJS history.

## Compatibility and Prerequisites

- Node.js 26 or newer is required.
- SQLite uses `better-sqlite3` 13.x, a native module distributed with N-API
  prebuilt binaries for common platforms; no compiler or `prebuild-install`
  step is required.
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
- `dg import --convert` uses heuristics and always creates proposed drafts
  that require human review.
- `dg push` upserts records and edges but does not remove server records
  missing from the local project.
- `dg pull` stores remote data in a separate local namespace and does not write
  into repository decision files.
- No npm release or published upgrade path is available yet.

## Validation

On Node.js 26, lint, formatting, typecheck, tests, build, `dg lint`, and
`dg verify` passed. The test run reported 52 passing tests and one skipped
test. A locally packed `0.1.0` tarball was installed in a temporary fixture;
initialization, MADR indexing, `dg context`, and `AGENTS.md` generation passed,
and the installed tree reported no audit vulnerabilities.
No live hosted MCP client or public npm release was validated as part of this
pre-release check.

## Security and Privacy

Local CLI and stdio MCP workflows access files and the SQLite index in the
selected project. Push transmits indexed records and project metadata to the
configured server. Pull imports server records into a separate namespace.
The server does not authenticate requests in v1; operators are responsible
for network restrictions and any TLS termination.

## Documentation

- [User guide](../user-guide.md)
- [Administrator guide](../admin-guide.md)
- [MCP client configuration](../mcp.md)
- [Architecture decision records](../decisions/README.md)
