# decision-graph — Unreleased

**Release date:** Not released

## Summary

This is the documentation baseline for the decision-graph project direction.
The repository contains an implementation plan but no runnable CLI or
decision-graph package. There is no released decision-graph version.

## Highlights

- Documents the current repository state and separates it from planned
  capabilities.
- Records that EJS is retired from active use and retained only as a historical
  archive.

## Compatibility and Prerequisites

There is no application version or runtime compatibility guarantee. Git is
required only to check out the repository. The `ejs-final` tag belongs to the
previous EJS project state, not to decision-graph.

## Installation or Upgrade

No decision-graph installation or upgrade is available. Use the repository
clone instructions in the [README](../../README.md) to read or contribute to
the project. There is no migration from EJS to a working decision-graph tool;
the [administrator guide](../admin-guide.md) describes current operational
limitations.

## Known Limitations

- The CLI, data index, search, agent integrations, and server are not
  implemented.
- No application configuration, test suite, build, or deployment procedure is
  present.
- Planned architecture and milestones are subject to change as implementation
  decisions are made.

## Validation

This documentation does not claim application tests or runtime validation.
There are no application build, test, or lint gates in the repository. The
documentation change is checked for local link consistency and whitespace
errors.

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
