# Administrator Guide

## Responsibilities and Architecture

decision-graph currently runs locally as a CLI and stdio MCP server, with a
SQLite index per project. There is no deployed multi-project service.
Repository maintainers manage the GitHub repository and keep the implementation
status accurate. The current scope and future architecture are documented in
the [implementation plan](IMPLEMENTATION-PLAN.md).

## Prerequisites

Git and Node.js 26 or newer with npm are required to build and validate the
CLI. Local SQLite storage is provided by `better-sqlite3`; no remote database,
container runtime, or cloud service is required.

## Installation

The package is not published to npm. To build it from source, clone the
repository, run `npm ci`, and then `npm run build`; see the
[README](../README.md) for details.

## Configuration

`dg init` creates the project's `.dg/config.json` and `.dg/graph.db`. MCP
clients start `dg mcp` from the project directory; see the
[MCP client guide](mcp.md). `DG_TEST_PG_URL` is reserved for planned Postgres
tests and is not a production setting.

## Identity, Secrets, and TLS

The local MCP server communicates over stdio and does not open a network
listener or require credentials. Repository access is governed by GitHub
permissions. Never store credentials in tracked files. Use GitHub's private
vulnerability reporting if enabled for this repository; a separate security
policy is not currently present.

## Storage and Backups

Markdown decision records are the source of truth; `.dg/graph.db` is a local,
rebuildable index. Back up or version the Markdown records through Git. If the
index is lost, recreate it with `dg sync`. Repository administrators should use
the backup and retention controls provided by their Git hosting organization.

## Health Checks and Monitoring

There is no deployed service endpoint to monitor. The local CLI and MCP process
run on demand; repository availability and access are provided by the
configured Git hosting platform.

## Upgrades and Rollback

The CLI package is not released, so application upgrades and rollbacks do not
apply. The `ejs-final` Git tag marks the prior EJS project state and is not a
decision-graph release. Follow the implementation plan for development
milestones; do not mistake planned compatibility for a tested upgrade path.

## Troubleshooting

- **Looking for decision commands:** use `dg --help` to see the implemented
  local workflows.
- **MCP client cannot start:** ensure the project is initialized, build the
  package, and verify the client command and working directory in the
  [MCP client guide](mcp.md).
- **Archived scripts or hooks are present:** they are preserved for historical
  reference and must not be installed or executed as part of decision-graph.

## Security and Privacy Checklist

- Keep credentials and private data out of committed files and public issues.
- Review repository visibility and collaborator permissions in GitHub.
- Use private vulnerability reporting for sensitive reports when available.
- Do not install or run archived EJS hooks, skills, bootstrap scripts, or
  session-recording workflows.
- Reassess authentication, network exposure, secret management, and data
  retention before implementing or deploying the planned multi-project server.
  The current MCP transport is local stdio only.

## Recovery and Support

Rebuild the local SQLite index from the repository's Markdown records with
`dg sync`. Recover repository state using the hosting provider's supported Git
recovery procedures and organizational backups. For project questions, use the
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues);
do not include secret values or sensitive vulnerability details in public
reports.
