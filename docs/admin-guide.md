# Administrator Guide

## Responsibilities and Architecture

decision-graph has no hosted control plane or user-account system. Operators
install the CLI, maintain Markdown decision records, and rebuild or back up
the index. `dg serve` exposes a multi-project HTTP API and streamable-HTTP MCP
using SQLite or PostgreSQL. Operators are responsible for access controls,
network boundaries, backups, and any TLS termination.

## Prerequisites

Node.js 26 or newer and npm are required. Git is required to clone the
repository. SQLite uses the native `better-sqlite3` module. PostgreSQL is
required only when using a PostgreSQL server or running its optional
integration tests. Docker Compose or Podman Compose is needed only for the
local PostgreSQL service.

## Installation

The package is not published to npm. From a checkout, run `npm ci` and
`npm run build`. To install the built package locally, run `npm pack` and
install the generated `decision-graph-0.1.0.tgz` tarball with npm. Do not
assume registry installation or upgrades are available until a release is
published. See the [README](../README.md#getting-started) for exact commands.

## Configuration

`dg init` writes `.dg/config.json`. The configuration fields are:

| Field | Purpose | Default |
|---|---|---|
| `project` | Project ID used to scope index records | Derived from the directory name |
| `projectType` | Project type used for remote cross-project selection | `cli-tool` |
| `adrDir` | Source directory for ADR Markdown | `docs/decisions/adr` |
| `sdrDir` | Source directory for SDR Markdown | `docs/decisions/sdr` |
| `agentsMd` | File where `dg compile` writes its managed block | `AGENTS.md` |
| `tokenBudget` | Maximum size of the managed instruction block | `1500` |
| `remote` | Default HTTP(S) server URL for push and pull, or `null` | `null` |

`dg serve` accepts `--db` (default `.dg/server.db`), `--port` (default
`3000`), and `--host` (default `127.0.0.1`). `dg push` and `dg pull` accept
`--remote`; `dg pull` also accepts `--project`.

The server also serves the read-only browser explorer at `/` from the same
origin as the API. Keep the default localhost binding: the UI does not add
authentication or change the access boundary of the API. In a source checkout,
`npm run dev` starts Vite on `127.0.0.1:5173` and proxies requests to the
server; `DG_API_ORIGIN` overrides the default API origin.

`DG_TEST_PG_URL` configures the optional PostgreSQL integration tests. The
local `docker-compose.yml` also supports `DG_PG_PORT` and
`POSTGRES_PASSWORD`; its fallback is for local development only and must not
be reused as a deployment credential.

Environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `DG_API_ORIGIN` | Vite development proxy target; development only | `http://127.0.0.1:3000` |
| `DG_TEST_PG_URL` | Optional PostgreSQL integration-test connection | Unset |
| `DG_PG_PORT` | Host port published by the local Compose service | `5432` |
| `POSTGRES_PASSWORD` | Password for the local Compose database only | Local-only fallback; set an appropriate development value and never reuse it for deployment |

`dg serve --db` accepts either a SQLite path or a PostgreSQL connection URL.
For PostgreSQL, pass the URL through `--db` and protect it in the invoking
environment; do not commit it to `.dg/config.json` or shell scripts.

The UI development proxy uses `DG_API_ORIGIN` only when running `npm run dev`;
it does not change the address or authentication behavior of the production
server.

## Identity, Secrets, and TLS

The stdio MCP server does not open a network listener. The HTTP server has no
authentication in v1. It binds to `127.0.0.1` by default and warns when bound
to a non-local interface, but that warning is not an access control. Do not
expose the server to an untrusted network. If remote access is required,
provide network restrictions and TLS termination outside decision-graph.
Keep server URLs and credentials out of tracked files and logs. Use the
repository's private vulnerability reporting if enabled; do not publish
sensitive vulnerability details in public issues.

## Storage and Backups

Markdown files are the source of truth. `.dg/graph.db` and `.dg/server.db` are
ignored local SQLite databases; the project index can be rebuilt with
`dg sync`. Back up and version record directories through Git. For a running
SQLite server, use a consistent SQLite backup procedure rather than copying a
live database file. For PostgreSQL, use the database platform's backup and
retention controls.

`dg push` updates server records and edges but does not delete server records
missing from a local project. `dg pull` copies server records into a separate
`remote:<fingerprint>:<project>` namespace and never edits repository
Markdown.

## Health Checks and Monitoring

`GET /projects` is a basic HTTP liveness check. `GET /` serves the browser
explorer. The server does not expose metrics or a dedicated health endpoint.
Monitor the process and, when used, PostgreSQL availability with the
deployment platform's standard tools.

The HTTP API also provides:

- `GET /` and `/assets/*` for the built browser explorer
- `POST /projects/:id/push`
- `GET /projects/:id/records`
- `GET /facets?project=...`
- `GET /search?q=...&project=...&type=...&status=...&tag=...`
- `GET /records/:project/:id`
- `GET /context?files=...&project=...&projectType=...`
- `GET /records/:project/:id/related?depth=...&kind=...`
- MCP at `/mcp`

Search filters accept repeated parameters. Different facets combine with AND;
multiple values for one facet combine with OR. An empty `q` returns a
title-sorted browse list, while a text query returns relevance-ranked records
across the selected projects.

## Upgrades and Rollback

The package manifest is version `0.1.0`, but no npm release has been
published. Install locally from a tarball or build from source; do not assume
registry upgrades are available. Markdown records are the canonical data, so
retain a Git revision before changing their format. The `ejs-final` tag marks
the historical EJS project state, not a decision-graph release or upgrade
target.

## Troubleshooting

- **Configuration validation fails:** check `.dg/config.json` against the
  fields and types above; `remote` must be an HTTP(S) URL or `null`.
- **PostgreSQL connection fails:** verify the URL supplied to `dg serve
  --db` or `DG_TEST_PG_URL`, database availability, and local firewall rules.
- **Remote push or pull fails:** verify the server URL, that the server is
  running, and that it is reachable from the client.
- **SQLite index is stale or missing:** run `dg sync` from the initialized
  project root.
- **Browser UI is missing or assets return 404:** build the package with
  `npm run build` before starting `dg serve`; confirm the package contains
  `dist/ui/`.
- **MCP client cannot start:** verify the configured executable path, Node.js
  runtime, project working directory, and `/mcp` URL for HTTP transport.
- **Archived scripts or hooks are present:** do not install or execute them;
  they are not decision-graph tooling.

## Security and Privacy Checklist

- Keep credentials and private data out of Markdown, `.dg/config.json`, and
  public issues.
- Do not bind the unauthenticated server to an untrusted interface.
- Use TLS termination and network access controls if remote access is
  required; these are operator-provided, not built into the server.
- Restrict PostgreSQL credentials, backups, and logs through the hosting
  platform.
- Do not install or run archived EJS hooks, skills, bootstrap scripts, or
  session-recording workflows.

## Recovery and Support

Rebuild a project index from its Markdown records with `dg sync`. Restore
server databases from operator-managed backups. Recover source files through
Git or the repository host. For user workflows, see the
[user guide](user-guide.md); for the current pre-release state, see the
[unreleased notes](releases/unreleased.md). For questions, use the
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues);
do not include credentials or sensitive vulnerability details.
