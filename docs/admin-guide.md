# Administrator Guide

## Responsibilities and Architecture

decision-graph runs as a CLI and stdio MCP server with a SQLite index per
project. `dg serve` can expose a multi-project HTTP API and streamable-HTTP MCP
using either SQLite or Postgres. Repository maintainers manage the GitHub
repository and keep the implementation status accurate. See the
[implementation plan](IMPLEMENTATION-PLAN.md) for scope and acceptance criteria.

## Prerequisites

Git and Node.js 26 or newer with npm are required to build and validate the
CLI. Local SQLite storage is provided by `better-sqlite3`; Postgres is required
only when serving with a Postgres connection URL or running the optional
integration tests.

## Installation

The package is not published to npm. To build it from source, clone the
repository, run `npm ci`, and then `npm run build`; see the
[README](../README.md) for details.

## Configuration

`dg init` creates the project's `.dg/config.json` and `.dg/graph.db`. Set the
`remote` field to an HTTP(S) decision-graph server URL, or supply `--remote` to
`dg push` / `dg pull`. Start a local server with
`dg serve --db .dg/server.db`; for Postgres, use
`dg serve --db "$DG_TEST_PG_URL"`. `docker-compose.yml` provides a
localhost-only Postgres instance for development and tests. MCP client setup
is documented in the [MCP client guide](mcp.md).

## Identity, Secrets, and TLS

The stdio MCP server does not open a network listener. `dg serve` has no
authentication in v1; it warns when bound to a non-local interface, but
administrators must still restrict network access and must not expose it to an
untrusted network. Use TLS termination and network controls if deploying behind
a trusted network boundary. Never store credentials in tracked files. Use
GitHub's private vulnerability reporting if enabled for this repository; a
separate security policy is not currently present.

## Storage and Backups

Markdown decision records are the source of truth; `.dg/graph.db` is a local,
rebuildable index. Back up or version the Markdown records through Git. If the
index is lost, recreate it with `dg sync`. Repository administrators should use
the backup and retention controls provided by their Git hosting organization.

## Health Checks and Monitoring

For a running service, `GET /projects` is a basic liveness check. Monitor the
process and Postgres availability using the deployment platform's standard
health and database checks; the server does not currently expose metrics.

## Upgrades and Rollback

The CLI package is not released, so application upgrades and rollbacks do not
apply. The `ejs-final` Git tag marks the prior EJS project state and is not a
decision-graph release. Follow the implementation plan for development
milestones; do not mistake planned compatibility for a tested upgrade path.

## Troubleshooting

- **Looking for decision commands:** use `dg --help` to see the implemented
  local workflows.
- **MCP client cannot start:** for stdio, ensure the project is initialized;
  for streamable HTTP, verify the server URL and `/mcp` endpoint. Build the
  package and check the [MCP client guide](mcp.md).
- **Archived scripts or hooks are present:** they are preserved for historical
  reference and must not be installed or executed as part of decision-graph.

## Security and Privacy Checklist

- Keep credentials and private data out of committed files and public issues.
- Review repository visibility and collaborator permissions in GitHub.
- Use private vulnerability reporting for sensitive reports when available.
- Do not install or run archived EJS hooks, skills, bootstrap scripts, or
  session-recording workflows.
- Reassess authentication, network exposure, secret management, and data
  retention before deploying the unauthenticated multi-project server.

## Recovery and Support

Rebuild the local SQLite index from the repository's Markdown records with
`dg sync`. Recover repository state using the hosting provider's supported Git
recovery procedures and organizational backups. For project questions, use the
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues);
do not include secret values or sensitive vulnerability details in public
reports.
