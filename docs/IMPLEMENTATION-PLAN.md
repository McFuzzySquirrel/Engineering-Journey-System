# decision-graph (`dg`) — Implementation Plan

> Status: **Phases 0-8 complete; Phase 9 implementation complete (npm publication pending)** · Tracks the pivot from the Engineering Journey System (EJS) to **decision-graph**.
> Tick boxes as work lands. Each phase has acceptance criteria. The phase is done only when every criterion is met.

---

## 1. Why

EJS recorded entire sessions: journey files, hooks, prompt logs, and story narratives. That costs a lot to maintain and a lot of context to read. Agents get the most value from **decisions they can find, scope, follow, and verify**.

**decision-graph** keeps the useful parts of EJS: the SQLite/FTS index, frontmatter parsing, DB-first querying, and a tiny always-on instruction surface. It drops the journey system and adds:

- **Hybrid MADR ADRs** combining MADR's human-readable rationale with [agent-optimized ADRs](https://actual.ai/blog/agent-optimized-adrs). Each one has a stable ID, `applies_to` globs, imperative `MUST` / `MUST NOT` / `SHOULD` rules, and concrete verification checks. Decision content is immutable after acceptance; a new record supersedes it, while lifecycle metadata and links may be updated.
- **SDRs (Session Decision Records)**. These are small records of decisions an agent makes during a session. An SDR can be promoted to an ADR.
- **A knowledge graph.** Records are nodes. Relationships are edges: supersedes, relates_to, derived_from, promoted_to, conflicts_with.
- **Agent access** in three ways: a CLI, an MCP server, and a compiled `AGENTS.md` block that stays in sync.
- **A multi-project server.** `dg serve` lets many repos of different project types push records to one database and query them from there.

## 2. Confirmed decisions

| Topic | Decision |
|---|---|
| Repo strategy | Rebuild in place. Tag `ejs-final`, then move the EJS system to `legacy/` |
| Language / distribution | Node.js + TypeScript, published to npm, binary `dg` |
| Local store | SQLite via **better-sqlite3**, nodes + edges + FTS5 |
| Remote store | **Postgres** (tsvector search) behind the same `Store` interface. SQLite fallback for single-user |
| Agent access | CLI (`dg context`), stdio MCP, managed AGENTS.md block |
| AGENTS.md content | Short usage instructions + compact index of accepted rules (ID, scope, MUST lines) under a token budget |
| SDR capture | Agents call `dg sdr add` (or the MCP `sdr_add` tool). No hooks |
| Server | `dg serve` in the same package: HTTP API + remote MCP. **No auth in v1** (localhost / trusted network only) |
| Native ADR format | Hybrid MADR: decision rationale and option analysis for humans, scoped rules and verification checks for agents |
| Import formats | MADR, Nygard / adr-tools, agent-optimized frontmatter |
| v1 extras | `dg verify`, `dg lint` (duplicates/conflicts), SDR→ADR promotion, graph export (Mermaid/DOT) |
| Dogfooding | Convert this repo's ADRs 0010–0018 once. Record the pivot as ADR-0001 |

## 3. Record formats

Markdown files in the repo are the **source of truth**. The DB is a rebuildable index.

### 3.1 ADR — `docs/decisions/adr/ADR-0001-<slug>.md`

````markdown
---
id: ADR-0001
type: adr
title: Image rendering
status: accepted            # proposed | accepted | superseded | deprecated
applies_to: ["**/*.tsx", "**/*.ts"]
tags: [frontend, performance]
supersedes: []              # record ids
relates_to: []
derived_from: []            # SDR ids
date: 2026-10-13
deciders: [Frontend team]
---

# ADR-0001: Use the framework image component

**Technical Story:** Improve image performance and prevent layout shift.

## Agent Rules

- **MUST:** Render images with the framework's `Image` component.
- **MUST NOT:** Use a raw `<img>` tag.
- **SHOULD:** Provide `width` and `height`, or use `fill`.

## Verify

- **Check:** `test -d app && ! rg -q "<img " app/`
- **Expected:** The command exits successfully without finding a raw `<img>` tag.

## Context and Problem Statement

Raw image elements bypass the framework's image optimization and make dimensions
easy to omit. How should application images be rendered?

## Decision Drivers

- Prevent avoidable layout shift.
- Apply the framework's image optimization consistently.

## Considered Options

- Use the framework's `Image` component.
- Continue using raw `<img>` elements.

## Decision Outcome

Chosen option: "Use the framework's `Image` component", because it addresses
both performance and layout stability through one enforceable convention.

### Positive Consequences

- Images receive the framework's optimization behavior.
- A repository check can detect violations.

### Negative Consequences

- Callers must provide dimensions or explicitly use `fill`.

## Pros and Cons of the Options

### Framework `Image` component

- Good, because optimization and sizing behavior are built in.
- Bad, because it requires framework-specific props.

### Raw `<img>` elements

- Good, because they use the standard HTML API.
- Bad, because optimization and layout stability depend on each caller.

## Links

None.
````

Rules:
- `id` never changes after creation.
- Individual rules get the IDs `ADR-0001#1`, `ADR-0001#2`, … in file order. Reviews and commits can cite them.
- Populate every section; write `None` when a section has nothing to record rather than removing its heading.
- Prefer automated checks. When automation is not practical, `Check` names a concrete manual review procedure and `Expected` states its observable result.
- Accepted decision content is immutable. To change a decision, write a new record with `supersedes: [ADR-0001]`, mark the old record `superseded`, and link the records in both directions.

### 3.2 SDR — `docs/decisions/sdr/SDR-20261013-001-<slug>.md`

```markdown
---
id: SDR-20261013-001
type: sdr
title: Use zod for frontmatter validation
status: open                # open | promoted | discarded
applies_to: ["src/core/**"]
agent: copilot-cli
session: <free-form session ref>
date: 2026-10-13
promoted_to: null
---

## Decision
Use zod schemas to validate record frontmatter.

## Why
Typed parse results and readable errors with no hand-rolled validation code.

## Alternatives considered
- ajv + JSON Schema — more verbose types
- hand-rolled checks — error-prone
```

### 3.3 Config — `.dg/config.json`

```json
{
  "project": "engineering-journey-system",
  "projectType": "cli-tool",
  "adrDir": "docs/decisions/adr",
  "sdrDir": "docs/decisions/sdr",
  "agentsMd": "AGENTS.md",
  "tokenBudget": 1500,
  "remote": null
}
```

`.dg/graph.db` is gitignored. `dg sync` rebuilds it.

## 4. Graph schema

The same logical schema is used for SQLite and Postgres:

```
projects(id PK, name, type, origin, updated_at)
nodes(project_id, id, type, title, status, applies_to JSON, tags JSON,
      rules JSON, verify TEXT, body TEXT, path, hash, date, updated_at,
      PK(project_id, id))
edges(project_id, src, dst, kind, PK(project_id, src, dst, kind))
      kind ∈ supersedes | relates_to | derived_from | promoted_to | conflicts_with
search: FTS5 virtual table (SQLite) / tsvector + GIN index (Postgres)
schema_version(version)
```

## 5. Architecture

```
src/
  core/      model.ts, schema.ts (zod), parse/{hybrid,agent,madr,nygard,detect}.ts,
             rules.ts, globs.ts (picomatch), compile.ts, lint.ts, graph.ts
  store/     store.ts (interface), sqlite.ts, postgres.ts, migrations/
  cli/       index.ts (commander), commands/*.ts
  mcp/       tools.ts (shared defs), stdio.ts, http.ts
  server/    app.ts (HTTP API), routes/*.ts
test/        unit + integration (vitest), fixtures/{hybrid,madr,nygard,agent,ejs}
```

Planned dependencies: `commander`, `better-sqlite3`, `pg`, `zod`, `js-yaml`, `picomatch`, `@modelcontextprotocol/sdk`, `hono` (or node:http). Dev dependencies: `typescript`, `tsup`, `vitest`, `eslint`, `prettier`.

---

## 6. Phases

### Phase 0 — Retire EJS to `legacy/`
- [x] Tag the current HEAD as `ejs-final` and push the tag
- [x] `git mv` into `legacy/`: `ejs-docs/`, `scripts/`, `_posts/`, `logs/`, `.github/hooks/`, `.github/skills/ejs-*`, `.github/agents/ejs-journey.agent.md`, `.github/copilot/pull_request_template.md`
- [x] Remove `.ejs.db`, `.ejs-session-active`, `.ejs-session-incomplete`. Update `.gitignore`
- [x] Replace `.github/copilot-instructions.md` with a minimal pointer to `AGENTS.md`
- [x] Add `legacy/README.md` explaining what EJS was and linking to the `ejs-final` tag
- [x] Rewrite the root `README.md` as a stub for decision-graph (the full version comes in Phase 9)

**Acceptance:** no hooks fire at session start. The repo root holds only the new project skeleton plus `legacy/`. `git log --follow` still finds the moved files.

**Completion notes:** `ejs-final` points to commit `3a0259d` and is published
to origin. The original README and recording instructions are also archived.
Untracked journeys and ignored logs remain preserved locally, not added to Git.
The active EJS hook configuration is absent; no EJS workflows are run to validate
this retirement.

### Phase 1 — Package scaffold
- [x] `package.json` (name `decision-graph`, `bin: { dg }`, `engines.node >=26`, ESM)
- [x] `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, eslint + prettier
- [x] `src/cli/index.ts` with `dg --version` / `dg --help`
- [x] GitHub Actions CI: install, lint, format, typecheck, test, build, and smoke-test CLI help/version on Node 26 (ubuntu, macos, windows)

**Acceptance:** `npm run build && node dist/cli.js --help` works. CI is green.

**Completion notes:** The build, CLI help/version, lint, format check, typecheck,
tests, and dependency audit pass locally. The Node 26 CI matrix passed on
Ubuntu, macOS, and Windows.

### Phase 2 — Core model & parsers
- [x] zod schemas for ADR, SDR, and config. Errors include file and field
- [x] Native hybrid MADR parser: frontmatter; agent rule lines (`MUST` / `MUST NOT` / `SHOULD` / `SHOULD NOT` / `MAY`); verification checks and expected results; context, drivers, options, outcome, consequences, pros/cons, and links
- [x] Rule-ID assignment (`<id>#<n>`)
- [x] MADR import parser (status, context, decision outcome, consequences)
- [x] Agent-optimized import parser (frontmatter, rules, Verify block, Context)
- [x] Nygard / adr-tools parser (numbered `NNNN-title.md`, `## Status` / `## Context` / `## Decision` / `## Consequences`, "Superseded by" links)
- [x] Format auto-detection
- [x] Content hash for incremental sync
- [x] Fixtures + unit tests for each format, including malformed inputs

**Completion notes:** Added zod models and file-aware validation, parser support
for hybrid MADR, MADR, agent-optimized, and Nygard records, deterministic rule
IDs, and SHA-256 content hashes. Parser fixtures cover each format and malformed
frontmatter; lint, format, typecheck, tests, build, CLI smoke checks, and npm
audit pass.

**Acceptance:** every fixture parses into a `Record` with the expected fields. Malformed files give actionable errors and don't crash.

### Phase 3 — SQLite store & graph
- [x] `Store` interface: `upsertProject`, `upsertNode`, `deleteMissing`, `addEdge`, `get`, `list(filter)`, `search(q, filter)`, `related(id, depth, kinds)`, `byGlobMatch(files)`
- [x] better-sqlite3 implementation with migrations and `schema_version`
- [x] FTS5 index with query sanitisation (ported from `legacy/scripts/adr-db.py`)
- [x] Graph traversal using recursive CTE
- [x] Tests on a temp DB: idempotent upserts, deletions, traversal depth, FTS edge cases

**Completion notes:** Added the shared store contract and a SQLite implementation
with versioned schema, project-scoped node/edge operations, idempotent
content-hash upserts, stale-node cleanup, FTS5 search, bounded recursive graph
traversal, and glob matching. Temporary-database tests cover idempotency,
project isolation, cascaded edge and search cleanup, traversal depth and kinds,
punctuation/operator search, filters, and glob matches. Lint, format, typecheck,
tests, and build pass.

**Acceptance:** syncing the same files twice gives zero changes. `related` returns the correct transitive closure.

### Phase 4 — Core CLI
- [x] `dg init [--type <projectType>] [--yes]`: writes config, creates dirs, adds `.dg/graph.db` to `.gitignore`, scans common ADR dirs (`doc/adr`, `docs/adr`, `docs/decisions`, `adr`, `architecture/decisions`) and offers to import them, runs the first sync and compile
- [x] `dg import <path> [--format auto|hybrid|madr|nygard|agent] [--convert]`: indexes records in place. `--convert` writes hybrid MADR drafts (`status: proposed`) into `adrDir` and keeps the originals
- [x] `dg sync`: incremental, file-hash based, removes records whose files are gone, then runs `compile`
- [x] `dg new "<title>" [--applies-to <glob>...] [--tags ...]`: next ADR id from the hybrid MADR template
- [x] `dg list [--status] [--type] [--tag]`, `dg get <id>`, `dg search <query>`
- [x] `dg context <files...>`: accepted rules whose `applies_to` matches any of the files, ordered by specificity. This is the main entry point for agents
- [x] `dg related <id> [--depth N] [--kind ...]`
- [x] Every query command supports `--json`

**Completion notes:** Implemented the complete local CLI flow, including config
initialization, common-directory import prompting, markdown parsing, incremental
SQLite indexing, stale-record removal, relationship rebuilding, hybrid draft
creation and import conversion, graph queries, and managed AGENTS.md usage
instructions. Conversion is idempotent. Temp-project integration tests cover
`init → sync → context`, import/conversion, draft creation, all query commands,
and JSON output; lint, format, typecheck, tests, and build pass.

**Acceptance:** in a temp repo with fixture ADRs, `init → sync → context src/x.tsx` returns exactly the matching rules. Integration tests cover each command.

### Phase 5 — SDRs & promotion
- [x] `dg sdr add "<title>" --decision ... --why ... [--alt ...] [--applies-to ...] [--agent ...] [--session ...]` writes the file and indexes it
- [x] `dg sdr list [--status open]`
- [x] `dg sdr promote <sdr-id>` creates an ADR draft (`proposed`) with `derived_from`, sets the SDR to `promoted` with `promoted_to`, and adds the edges
- [x] `dg sdr discard <sdr-id> [--reason]`

**Completion notes:** Added date-sequenced SDR creation, indexing, and open-by-
default listing. Promotion writes a proposed ADR carrying the SDR's decision,
rationale, alternatives, scope, and tags; updates the SDR lifecycle metadata;
and creates both `derived_from` and `promoted_to` graph edges. Promoting a
non-open SDR is rejected. Discard updates lifecycle metadata and records an
optional reason in the SDR file. CLI integration tests cover creation, listing,
promotion, both edges, repeat-promotion rejection, and discard.

**Acceptance:** after promote, both files and the edges are correct, and running promote again is rejected.

### Phase 6 — AGENTS.md compile, verify, lint, graph export
- [x] `dg compile` writes the managed block between `<!-- dg:begin -->` and `<!-- dg:end -->`. Content outside the markers is left alone, and the file is created if missing. The block contains:
  - a short usage section ("run `dg context <files>` before editing; record decisions with `dg sdr add`; MCP server: `dg mcp`")
  - a compact index of accepted rules (`ADR-0001#1 [**/*.tsx] MUST …`), trimmed to `tokenBudget`. When trimmed, it says to use `dg context` for the full list
  - deterministic output, so diffs stay clean
- [x] `dg verify [id...] [--timeout s]` runs automated `Check` commands from the repo root, uses their exit status for pass/fail, and displays `Expected` with the result. It prints a pass/fail/skip table and exits non-zero on failure; manual checks and records without checks are skipped with the review procedure shown
- [x] `dg lint`:
  - schema errors, duplicate IDs, unknown link targets, supersede cycles
  - accepted records that are superseded but not marked `superseded`
  - near-duplicate rules (normalized token Jaccard ≥ threshold) across records
  - conflicts: overlapping `applies_to` + the same normalized subject with opposite modality (MUST vs MUST NOT). Adds `conflicts_with` edges
  - `--json`, exits non-zero on errors
- [x] `dg graph [--format mermaid|dot] [--root id] [--depth N]`

**Completion notes:** `dg compile` now generates a deterministic accepted-rule
index under the managed AGENTS.md markers, preserves surrounding content, and
trims the index to the configured token budget with a `dg context` fallback.
`dg verify` runs checks from the project root with per-command timeouts, shows
expected results, and reports manual or absent checks as skips. `dg lint`
reports schema and graph errors, near-duplicate warnings,
supersede cycles, stale accepted statuses, and overlapping opposite rules; it
also rebuilds `conflicts_with` edges. `dg graph` exports deterministic Mermaid
or DOT output with optional root/depth filtering. CLI tests cover golden compile
output, marker preservation, token trimming, passing/failing/skipped/timed-out
checks, lint diagnostics and conflict edges, and both graph formats. Lint,
format, typecheck, all tests, and build pass on Node 26.

**Acceptance:** golden-file tests for compile output. Lint fixtures cover each rule. Verify reports correctly on passing, failing, and timed-out commands.

### Phase 7 — MCP (stdio)
- [x] Shared tool definitions in `src/mcp/tools.ts`: `search`, `context`, `get`, `related`, `list`, `sdr_add`, `lint`
- [x] `dg mcp` stdio transport
- [x] Config snippets for Copilot CLI / VS Code, Claude Code, and Cursor (docs)
- [x] Tests using the MCP SDK client against the server in-process

**Completion notes:** Added MCP SDK 1.32.1 tool registration over the shared
store interface, a `dg mcp` stdio command, shared context and project-lint
operations, and MCP-backed SDR creation. Added client configuration examples
for Copilot CLI, VS Code, Claude Code, and Cursor. In-process MCP client tests
verify tool discovery, CLI-equivalent context results, and all seven tools.

**Acceptance:** an MCP client can list the tools and get `context` results that match the CLI's.

### Phase 8 — Postgres store, server, push/pull
- [x] Postgres `Store` implementation: same migrations, tsvector + GIN search, project scoping
- [x] `dg serve [--db <postgres-url|sqlite-path>] [--port] [--host 127.0.0.1]`
  - HTTP API: `POST /projects/:id/push` (bulk upsert by hash), `GET /projects`, `GET /projects/:id/records`, `GET /search?q=&project=&projectType=`, `GET /context?project=&files=`, `GET /records/:project/:id/related`
  - streamable-HTTP MCP endpoint `/mcp` using the shared tools, with optional `project` / `projectType` arguments for cross-project queries
  - warns at startup when bound to anything other than localhost (no auth in v1)
- [x] `dg push [--remote url]` / `dg pull [--remote url] [--project ...]` (pull imports read-only into a separate namespace and never writes into the repo's files)
- [x] `remote` setting in config
- [x] Postgres integration tests run when `DG_TEST_PG_URL` is set. `docker-compose.yml` for local Postgres

**Completion notes:** Added a Postgres implementation of the Promise-based
store contract with project-scoped graph operations and `tsvector`/GIN search.
`dg serve` now exposes project, push, records, search, context, related-record,
and streamable-HTTP MCP endpoints; non-local binds warn that v1 has no
authentication. `dg push` safely upserts indexed records and edges, while
`dg pull` imports records into a separate local namespace without changing
repository files. The remote URL can come from `.dg/config.json` or `--remote`.
Podman-backed Postgres integration tests and the CLI's SQLite-server remote
flow pass; the compose file supplies a localhost-only Postgres service.

**Acceptance:** two fixture repos of different project types push to one server, and a cross-project search by `projectType` returns the expected records. Re-pushing is safe (no duplicates).

### Phase 9 — Dogfood & docs
- [x] Run `dg init --type cli-tool` in this repo
- [x] Convert `legacy/ejs-docs/adr/0010–0018` into hybrid MADR ADRs. Mark the EJS-specific ones `deprecated` or have ADR-0001 supersede them
- [x] Write **ADR-0001: Pivot from EJS to decision-graph**
- [x] Record SDRs for the significant implementation decisions made in Phases 1–8
- [x] `dg lint` and `dg verify` both pass. AGENTS.md is generated
- [x] README: concept, record formats, quickstart, command reference, MCP setup, server setup, a migration note for EJS users
- [x] CI job runs `dg lint` and `dg verify` on this repo
- [ ] Publish to npm (manual step, `0.1.0`)

**Completion notes:** Initialized this repository as `cli-tool`, converted ADRs
0010–0018 to deprecated hybrid MADRs, and added accepted ADR-0001 to supersede
them. Eight SDRs capture the significant design decisions across Phases 1–8.
The generated `AGENTS.md`, README, and CI checks are in place. `dg lint` and
`dg verify` pass. A local `0.1.0` tarball was installed into a temporary fixture
with an existing hybrid MADR; `dg init`, indexing, `dg context`, and AGENTS.md
generation succeeded. The npm registry publication remains a separate manual
release step.

**Acceptance:** a fresh clone can run `npx decision-graph init` in an unrelated repo with existing MADR ADRs. In that repo, `dg context` returns rules and AGENTS.md is generated.

---

## 7. Risks & notes

- **better-sqlite3 is a native module.** It ships prebuilt binaries for common platforms. Document Node 26+ and the build-from-source fallback.
- **`--convert` uses heuristics.** It pulls imperative sentences out of prose. Its output is always `proposed` and needs human review. There is no LLM dependency in v1.
- **Conflict detection uses heuristics.** It errs toward warnings, not errors.
- **There is no auth in v1.** The server binds to localhost by default and warns loudly otherwise. Token auth is a follow-up.
- **Moving `.github/hooks` intentionally ends EJS session scaffolding.**
- **Pull never writes into a repo's decision files.** Repo files stay the source of truth for that repo.

## 8. Out of scope for v1 (candidates for later)

- Server auth (tokens or GitHub OAuth)
- LLM-assisted ADR generation from code (static analysis)
- Extra compile targets: `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`
- Agent hooks that prompt for SDRs at session end
- PR review bot that checks diffs against `dg context`
- Web UI for browsing the graph
