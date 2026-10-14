# User Guide

## Who This Is For

This guide is for developers and coding agents that need to find and follow
relevant architecture decisions. The CLI supports local SQLite workflows,
Postgres-backed multi-project serving, remote push/pull, and stdio or
streamable-HTTP MCP.

## Before You Begin

You need Git and Node.js 26 or newer with npm to build the CLI from
this repository. Start with the [README](../README.md) and
[implementation plan](IMPLEMENTATION-PLAN.md).

## Sign In and First Use

Signing in is not applicable: there is no hosted service. Clone the repository,
run `npm ci` and `npm run build`, then use `node dist/cli.js --help` to see the
available commands. In a project, run `node dist/cli.js init` to create its
configuration and local SQLite index.

## Main Workflows

Use `dg init` to initialize a project, `dg sync` to index its decision records,
and `dg context <files...>` to retrieve applicable accepted rules. Other
workflows include `dg search`, `dg get`, `dg related`, `dg sdr add`, `dg lint`,
`dg verify`, `dg graph`, `dg push`, and `dg pull`. Set `.dg/config.json`'s
`remote` value or pass `--remote <url>` to push and pull. A pull stores records
in a separate `remote:<fingerprint>:<project>` database namespace and never
writes them into the project's Markdown directories.

Run `dg serve --db <postgres-url|sqlite-path>` to start the HTTP API and
streamable-HTTP MCP endpoint. The server binds to `127.0.0.1` by default. For
local Postgres, use `podman-compose up -d` (or `docker compose up -d`) and set
`DG_TEST_PG_URL` when running the optional integration tests. To connect an
agent, use stdio MCP or the remote endpoint as described in the
[MCP client guide](mcp.md).

## Offline and Reconnect Behavior

Local CLI and stdio MCP workflows use the project's Markdown files and SQLite
index. Remote push/pull and `dg serve` require network access. Push is
idempotent and upserts records; it does not delete server records that are
missing from the local project. Synchronize the local index after changing
records with `dg sync`.

## Statuses and Notifications

The CLI has no notification system. ADR and SDR records have lifecycle statuses
such as `proposed`, `accepted`, `open`, and `promoted`; commands such as `dg
list`, `dg get`, and `dg sdr list` show indexed records.

## Attachments or Other Data

There is no application upload or attachment feature. The repository currently
contains Markdown documentation and a preserved, inactive EJS archive.

## Accessibility and Mobile Use

There is no application interface to evaluate for keyboard, screen-reader, or
mobile support. Repository Markdown can be viewed with accessible GitHub or
local Markdown tools; no product-level accessibility claim is made.

## Privacy and Data Handling

The local CLI and stdio MCP server read and update files and the SQLite index
in the selected project. `dg push` sends indexed records and project metadata
to the configured remote; `dg pull` downloads records to the local index
without modifying repository files. The server has no authentication in v1:
keep it on localhost or a trusted network and do not expose it publicly.
Repository content and issue or pull-request data are handled by Git and
GitHub according to the user's and repository host's settings. Do not commit
credentials, private data, or session content that should not be public.

## Troubleshooting

- **Looking for MCP setup?** See the [MCP client guide](mcp.md) for Copilot
  CLI, VS Code, Claude Code, and Cursor configuration.
- **Unsure whether a feature exists?** Check its phase and checkbox status in
  the [implementation plan](IMPLEMENTATION-PLAN.md).
- **Found old EJS instructions?** They are historical. Do not run archived
  hooks, skills, scripts, or session-recording workflows under `legacy/`.

The SQLite index is rebuildable from decision-record Markdown using `dg sync`.
If a local checkout is lost, clone it again; for committed repository content,
use the Git hosting provider's supported recovery process.

## Getting Help

Use the repository's
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues)
for questions and non-sensitive reports. Do not publish sensitive vulnerability
details in a public issue.
