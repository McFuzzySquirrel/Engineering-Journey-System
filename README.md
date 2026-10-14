# decision-graph (`dg`)

decision-graph indexes architecture decision records (ADRs) and session
decision records (SDRs) so developers and coding agents can find, scope, and
verify durable decisions. Markdown files are the source of truth; a local
SQLite database is a rebuildable index. The CLI also provides an MCP server
and can serve multiple projects over HTTP.

## Concepts

- **ADRs** capture durable decisions, rationale, scoped agent rules, and
  verification checks. The native format is a hybrid MADR.
- **SDRs** capture smaller decisions made during a working session. An SDR can
  be promoted into a proposed ADR.
- **The graph** links records through superseding, relating, derivation,
  promotion, and conflict relationships.
- **`AGENTS.md`** contains a generated, managed block with usage instructions
  and a compact index of accepted rules. Edit content outside the markers;
  `dg compile` maintains the block.

## Record formats

The native hybrid MADR format uses YAML frontmatter and Markdown sections for
agent rules, checks, context, decision drivers, options, outcomes, and
consequences. The parser also imports conventional MADR, Nygard/adr-tools, and
agent-optimized records. Run `dg import` to index source records; `--convert`
creates proposed hybrid MADR drafts and keeps the originals for review.

## Quickstart

Requires Node.js 26 or newer and npm. Until the package is published, create
and install a local tarball:

```sh
npm ci
npm run build
npm pack
npm install --global ./decision-graph-0.1.0.tgz
dg init --type cli-tool
dg context src/index.ts
```

After publication, install with `npm install --global decision-graph`.

To build from source instead:

```sh
git clone https://github.com/McFuzzySquirrel/Engineering-Journey-System.git
cd Engineering-Journey-System
npm ci
npm run build
node dist/cli.js --help
```

In an existing project, initialize with an appropriate project type, add or
import ADRs, then use `dg context <files...>` before changing code. Run
`dg sync` after editing records. `dg sdr add` captures a decision; use
`dg sdr promote <id>` when it warrants an ADR.

## Command reference

| Command | Purpose |
|---|---|
| `dg init [--type <type>] [--yes]` | Create `.dg/config.json`, record directories, and the local index |
| `dg import <path> [--format auto\|hybrid\|madr\|nygard\|agent] [--convert]` | Index or convert existing records |
| `dg sync` | Re-index configured records, remove missing records, and compile `AGENTS.md` |
| `dg new "<title>" [--applies-to <glob...>] [--tags <tag...>]` | Create a proposed hybrid ADR |
| `dg sdr add "<title>" --decision <text> --why <text>` | Capture a session decision |
| `dg sdr list [--status <status>]` | List SDRs |
| `dg sdr promote <id>` / `dg sdr discard <id> [--reason <text>]` | Promote or discard an SDR |
| `dg list [--status <status>] [--type <type>] [--tag <tag>]` | List indexed records |
| `dg get <id>` / `dg search <query>` | Inspect or search records |
| `dg context <files...>` | Find accepted rules matching files |
| `dg related <id> [--depth <n>] [--kind <kind...>]` | Traverse related records |
| `dg compile` | Regenerate the managed `AGENTS.md` block |
| `dg verify [id...] [--timeout <seconds>]` | Run record checks and report pass/fail/skip |
| `dg lint [--json]` | Check record schemas, links, lifecycle, duplicates, and conflicts |
| `dg graph [--format mermaid\|dot] [--root <id>] [--depth <n>]` | Export the record graph |
| `dg mcp` | Start the stdio MCP server |
| `dg serve [--db <postgres-url\|sqlite-path>] [--port <port>] [--host <host>]` | Start the HTTP API and streamable-HTTP MCP endpoint |
| `dg push [--remote <url>]` / `dg pull [--remote <url>]` | Push records or import them into a read-only remote namespace |

Query commands support `--json`. Run `dg --help` or `dg <command> --help`
for complete options.

## MCP setup

The stdio MCP server exposes `search`, `context`, `get`, `related`, `list`,
`sdr_add`, and `lint`. See the [MCP client configuration guide](docs/mcp.md)
for Copilot CLI, VS Code, Claude Code, Cursor, and streamable-HTTP examples.

## Server setup

`dg serve --db .dg/server.db --host 127.0.0.1 --port 3000` starts the HTTP API
and MCP endpoint. A PostgreSQL URL can be used instead of a SQLite path.
`docker-compose.yml` provides a local PostgreSQL service for development and
integration tests. The server has no authentication in v1: keep it on
localhost or a trusted network, and do not expose it publicly.

Push sends indexed records to a server; it does not delete server-side records
missing from the local project. Pull imports records to a separate local
namespace and never writes into repository decision files.

## Migrating from EJS

The former Engineering Journey System (EJS) is preserved under [`legacy/`](legacy/README.md)
as an inactive archive. Its hooks, skills, scripts, and session-recording
workflows are not part of decision-graph and must not be run. Existing EJS ADRs
have been converted into deprecated hybrid ADR records in
`docs/decisions/adr/`; the pivot ADR supersedes them. To adopt decision-graph
in another repository, install the CLI, run `dg init`, and import existing
MADR or other supported ADR files. Review any generated `--convert` drafts
before accepting them.

## Development

Run `npm ci`, then `npm run lint`, `npm run format:check`,
`npm run typecheck`, `npm test`, and `npm run build`. CI also runs
`dg lint` and `dg verify` on Node.js 26.

The [implementation plan](docs/IMPLEMENTATION-PLAN.md) tracks project scope.
See the [user guide](docs/user-guide.md), [administrator guide](docs/admin-guide.md),
and [MCP guide](docs/mcp.md) for additional operational details.

## License

MIT; see [LICENSE](LICENSE).
