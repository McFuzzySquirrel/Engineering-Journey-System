# User Guide

## Who This Is For

This guide is for developers and coding agents who need to record decisions,
find rules that apply to files, or share decision records with a trusted
decision-graph server. It covers local CLI use as well as the available MCP
and remote workflows.

## Before You Begin

You need Node.js 26 or newer. To build from this repository, install Git and
npm dependencies with `npm ci`, then run `npm run build`. The package is not
published to npm yet; for local package installation see the
[README quickstart](../README.md#getting-started). Use `dg --help` to confirm
the CLI is available.

## Sign In and First Use

Signing in is not applicable: decision-graph has no hosted account service.
In a repository where the CLI is installed, run:

```sh
dg init --type cli-tool
```

`--type` is optional and defaults to `cli-tool`. Initialization creates
`.dg/config.json`, the configured ADR and SDR directories, the local SQLite
index, and an agent skill (`.agents/skills/decision-graph` by default). If one
recognized ADR directory contains records, `dg init` offers to use it as
`adrDir`; pass `--yes` to accept that and any import prompt. Re-running
`dg init` resumes without rewriting the configuration, and records that fail
to parse are reported without aborting initialization. Use `--adr-dir <path>`
to choose the ADR directory, `--agent-skill none` to skip the skill, and
`--force` to rewrite an existing configuration.

For an existing checkout that has not been installed globally, use
`node dist/cli.js` in place of `dg` after `npm ci` and `npm run build`.

## Main Workflows

**Find applicable rules.** After initialization and adding or importing
records, synchronize the index and query files before editing:

```sh
dg sync
dg context src/cli/commands.ts
```

`dg context` returns rules from accepted ADRs whose `applies_to` globs match
the requested paths. It orders results by scope specificity. `dg search`,
`dg get`, `dg list`, and `dg related` query record text, metadata, or graph
relationships. Query commands support `--json`.

**Create decisions.** Use `dg adr create "<title>"` to create a proposed ADR
draft. The existing `dg new "<title>"` command remains available as a shorthand.
Both commands accept `--applies-to <glob...>` and `--tags <tag...>`, and index
the new ADR immediately. For a session decision, provide a title, decision, and
reason:

```sh
dg sdr add "Keep Markdown as the source" \
  --decision "Store source decisions in Markdown." \
  --why "Records stay reviewable in version control."
dg sdr list
```

An open SDR can be promoted to a proposed ADR with `dg sdr promote <sdr-id>`,
or discarded with `dg sdr discard <sdr-id> [--reason <text>]`. Review and
edit a proposed ADR before accepting it; update its status in the Markdown
record and run `dg sync`.

**Import existing ADRs.** `dg import <path>` auto-detects supported Markdown
formats. Use `--format` to select `hybrid`, `madr`, `nygard`, or `agent`.
`--convert` creates proposed hybrid drafts and preserves the source records;
review drafts rather than treating heuristic conversion as an accepted
decision. IDs are inferred from frontmatter, `ADR-0001` or `ADR 001` headings,
and numbered filenames such as `001-title.md`, preserving the source digits.
Legacy records without frontmatter may use `**Status:**`, `**Date:**`, and
`**Tags:**` lines before the first section. Files that cannot be parsed are
reported individually; `dg lint --json` lists the same diagnostics.

**Check records.** Run `dg lint` for schema, relationship, lifecycle, and rule
diagnostics. Run `dg verify [id...]` for automated checks; checks that are
manual or absent are reported as skipped. `dg graph --format mermaid` exports
the graph in Mermaid format; `dot` is also supported.

**Use remote projects.** Set `remote` in `.dg/config.json`, or pass
`--remote <url>` to `dg push` or `dg pull`. Push sends the local project's
indexed records and edges to the server; it upserts and does not delete
server records absent from the local project. Pull imports selected or all
server projects into separate `remote:<fingerprint>:<project>` local
namespaces and does not write to repository Markdown files.

`dg serve` exposes the HTTP API and streamable-HTTP MCP endpoint. It defaults
to `127.0.0.1:3000` and has no authentication in v1; use only on localhost or
a trusted network. Configure MCP clients using the
[MCP client guide](mcp.md).

## Offline and Reconnect Behavior

Local queries and stdio MCP use the project's Markdown files and SQLite
index; they do not require a network connection. `dg push`, `dg pull`,
`dg serve`, and streamable-HTTP MCP require connectivity to the configured
server. Run `dg sync` after changing decision records so local queries and
subsequent pushes use current content.

## Statuses and Notifications

The CLI has no notification system. ADR statuses are `proposed`, `accepted`,
`superseded`, and `deprecated`; SDR statuses are `open`, `promoted`, and
`discarded`. Use `dg list`, `dg get`, and `dg sdr list` to inspect indexed
records. `dg sdr list` defaults to open SDRs.

## Attachments or Other Data

There is no upload or attachment feature. Decision content is stored in
Markdown records; the SQLite database is a rebuildable index. EJS materials
are preserved as an inactive archive under `legacy/`.

## Accessibility and Mobile Use

decision-graph is a CLI and MCP service, not a graphical application. It has
no mobile interface or product UI accessibility claim. Repository Markdown
can be read with accessible GitHub or local Markdown tools.

## Privacy and Data Handling

The local CLI and stdio MCP server read decision files and the SQLite index in
the selected project. `dg push` sends indexed records, edges, and project
metadata to the configured server. `dg pull` receives server records into a
separate local namespace without modifying repository files. The remote
server has no authentication in v1; send data only to a server you trust and
do not expose it to an untrusted network. Do not commit credentials or
private content.

## Troubleshooting

- **`Not initialized`:** Run `dg init` from the project root.
- **No applicable context:** Check the file path and ADR `applies_to` globs,
  confirm the ADR is accepted, then run `dg sync`.
- **Missing imported records:** Confirm the path contains Markdown files and
  use `dg import --format <format>` if format detection is ambiguous.
- **Checks fail or time out:** Review the verification command and expected
  result in the ADR; `dg verify --timeout <seconds>` changes the timeout.
- **MCP client cannot connect:** Confirm the CLI is built or installed, the
  client command points at the project CLI, and the client runs from the
  initialized project.
- **Old EJS guidance appears:** Treat it as archive material. Do not run
  hooks, skills, scripts, bootstrap scripts, or session workflows under
  `legacy/`.

The local index can be rebuilt from Markdown with `dg sync`. Repository
records should be recovered through Git or the repository host.

## Getting Help

See the [administrator guide](admin-guide.md) for operations and security, or
the [ADR index](decisions/README.md) for architecture decisions. Use the
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues)
for questions and non-sensitive reports. Do not publish sensitive
vulnerability details in a public issue.
