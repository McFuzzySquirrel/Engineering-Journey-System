# decision-graph — Unreleased

**Release date:** Not released

## Summary

The `decision-graph` package scaffold is implemented but not released. The
`dg` CLI currently supports `--help` and `--version`; decision indexing and
other product workflows remain planned.

## Highlights

- Adds a Node.js/TypeScript CLI scaffold with lint, format, typecheck, test, and
  build commands.
- Adds cross-platform GitHub Actions checks for Node 20.19, 22.13, and 24.
- Records that EJS is retired from active use and retained only as a historical
  archive.

## Compatibility and Prerequisites

The package supports Node.js 20.19+, 22.13+, or 24+ and has version `0.1.0`;
it is not published to npm. The `ejs-final` tag belongs to the previous EJS
project state, not to decision-graph.

## Installation or Upgrade

The package is not published. To build the CLI from source, use the clone and
`npm ci` instructions in the [README](../../README.md). There is no migration
from EJS to a feature-complete decision-graph tool; the
[administrator guide](../admin-guide.md) describes current limitations.

## Known Limitations

- Only CLI help and version are implemented; the data index, search, agent
  integrations, and server are not implemented.
- There is no application configuration or deployment procedure.
- Planned architecture and milestones are subject to change as implementation
  decisions are made.

## Validation

Local build, CLI help/version, and dependency audit checks pass. GitHub Actions
runs lint, format, typecheck, tests, build, and CLI help/version smoke checks on
Node 20.19, 22.13, and 24 across Ubuntu, macOS, and Windows; the dependency
audit is local-only.

## Security and Privacy

There is no application service that collects user data. Repository content
and GitHub interactions are subject to repository-host settings. Do not place
secrets or private user data in documentation or public reports.

## Documentation

- [README](../../README.md)
- [User guide](../user-guide.md)
- [Administrator guide](../admin-guide.md)
- [ADR index](../adr/README.md)
- [Implementation plan](../IMPLEMENTATION-PLAN.md)
- [Changelog](../../CHANGELOG.md)
