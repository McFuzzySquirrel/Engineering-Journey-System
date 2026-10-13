# decision-graph (`dg`) — Implementation Plan

> Status: **Planned** · Tracks the pivot from the Engineering Journey System (EJS) to **decision-graph**.
> Tick boxes as work lands. Each phase has acceptance criteria. The phase is done only when every criterion is met.

---

## 1. Why

EJS recorded entire sessions: journey files, hooks, prompt logs, and story narratives. That costs a lot to maintain and a lot of context to read. Agents get the most value from **decisions they can find, scope, follow, and verify**.

**decision-graph** keeps the useful parts of EJS: the SQLite/FTS index, frontmatter parsing, DB-first querying, and a tiny always-on instruction surface. It drops the journey system and adds:

- **Agent-optimized ADRs** (based on [actual.ai: agent-optimized ADRs](https://actual.ai/blog/agent-optimized-adrs)). Each one has a stable ID, `applies_to` globs, imperative `MUST` / `MUST NOT` / `SHOULD` rules, and a `Verify` command. Records are never edited after acceptance; a new record supersedes them.
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
---

# Image rendering

MUST: Render images with the framework's `Image` component.
MUST NOT: Use a raw `<img>` tag.
SHOULD: Provide `width` and `height`, or use `fill`.

## Verify

```sh
rg "<img " app/ && exit 1 || exit 0
```

## Context

One or two short paragraphs. Link out for the long story.
````

Rules:
- `id` never changes after creation.
- Individual rules get the IDs `ADR-0001#1`, `ADR-0001#2`, … in file order. Reviews and commits can cite them.
- Keep files ≤ ~200 lines. `dg lint` warns above that.
- An accepted record is immutable. To change a decision, write a new record with `supersedes: [ADR-0001]`.

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
  core/      model.ts, schema.ts (zod), parse/{agent,madr,nygard,detect}.ts,
             rules.ts, globs.ts (picomatch), compile.ts, lint.ts, graph.ts
  store/     store.ts (interface), sqlite.ts, postgres.ts, migrations/
  cli/       index.ts (commander), commands/*.ts
  mcp/       tools.ts (shared defs), stdio.ts, http.ts
  server/    app.ts (HTTP API), routes/*.ts
test/        unit + integration (vitest), fixtures/{madr,nygard,agent,ejs}
```

Planned dependencies: `commander`, `better-sqlite3`, `pg`, `zod`, `gray-matter`, `picomatch`, `@modelcontextprotocol/sdk`, `hono` (or node:http). Dev dependencies: `typescript`, `tsup`, `vitest`, `eslint`, `prettier`.

---

## 6. Phases

### Phase 0 — Retire EJS to `legacy/`
- [ ] Tag the current HEAD as `ejs-final` and push the tag
- [ ] `git mv` into `legacy/`: `ejs-docs/`, `scripts/`, `_posts/`, `logs/`, `.github/hooks/`, `.github/skills/ejs-*`, `.github/agents/ejs-journey.agent.md`, `.github/copilot/pull_request_template.md`
- [ ] Remove `.ejs.db`, `.ejs-session-active`, `.ejs-session-incomplete`. Update `.gitignore`
- [ ] Replace `.github/copilot-instructions.md` with a minimal pointer to `AGENTS.md`
- [ ] Add `legacy/README.md` explaining what EJS was and linking to the `ejs-final` tag
- [ ] Rewrite the root `README.md` as a stub for decision-graph (the full version comes in Phase 9)

**Acceptance:** no hooks fire at session start. The repo root holds only the new project skeleton plus `legacy/`. `git log --follow` still finds the moved files.

### Phase 1 — Package scaffold
- [ ] `package.json` (name `decision-graph`, `bin: { dg }`, `engines.node >= 20`, ESM)
- [ ] `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, eslint + prettier
- [ ] `src/cli/index.ts` with `dg --version` / `dg --help`
- [ ] GitHub Actions CI: install, lint, typecheck, test on Node 20 & 22 (ubuntu, macos, windows)

**Acceptance:** `npm run build && node dist/cli.js --help` works. CI is green.

### Phase 2 — Core model & parsers
- [ ] zod schemas for ADR, SDR, and config. Errors include file and field
- [ ] Agent-optimized parser: frontmatter, rule lines (`MUST` / `MUST NOT` / `SHOULD` / `SHOULD NOT` / `MAY`), `## Verify` fenced block, `## Context`
- [ ] Rule-ID assignment (`<id>#<n>`)
- [ ] MADR parser (status, context, decision outcome, consequences)
- [ ] Nygard / adr-tools parser (numbered `NNNN-title.md`, `## Status` / `## Context` / `## Decision` / `## Consequences`, "Superseded by" links)
- [ ] Format auto-detection
- [ ] Content hash for incremental sync
- [ ] Fixtures + unit tests for each format, including malformed inputs

**Acceptance:** every fixture parses into a `Record` with the expected fields. Malformed files give actionable errors and don't crash.

### Phase 3 — SQLite store & graph
- [ ] `Store` interface: `upsertProject`, `upsertNode`, `deleteMissing`, `addEdge`, `get`, `list(filter)`, `search(q, filter)`, `related(id, depth, kinds)`, `byGlobMatch(files)`
- [ ] better-sqlite3 implementation with migrations and `schema_version`
- [ ] FTS5 index with query sanitisation (ported from `legacy/scripts/adr-db.py`)
- [ ] Graph traversal using recursive CTE
- [ ] Tests on a temp DB: idempotent upserts, deletions, traversal depth, FTS edge cases

**Acceptance:** syncing the same files twice gives zero changes. `related` returns the correct transitive closure.

### Phase 4 — Core CLI
- [ ] `dg init [--type <projectType>] [--yes]`: writes config, creates dirs, adds `.dg/graph.db` to `.gitignore`, scans common ADR dirs (`doc/adr`, `docs/adr`, `docs/decisions`, `adr`, `architecture/decisions`) and offers to import them, runs the first sync and compile
- [ ] `dg import <path> [--format auto|madr|nygard|agent] [--convert]`: indexes records in place. `--convert` writes agent-optimized drafts (`status: proposed`) into `adrDir` and keeps the originals
- [ ] `dg sync`: incremental, file-hash based, removes records whose files are gone, then runs `compile`
- [ ] `dg new "<title>" [--applies-to <glob>...] [--tags ...]`: next ADR id from the template
- [ ] `dg list [--status] [--type] [--tag]`, `dg get <id>`, `dg search <query>`
- [ ] `dg context <files...>`: accepted rules whose `applies_to` matches any of the files, ordered by specificity. This is the main entry point for agents
- [ ] `dg related <id> [--depth N] [--kind ...]`
- [ ] Every query command supports `--json`

**Acceptance:** in a temp repo with fixture ADRs, `init → sync → context src/x.tsx` returns exactly the matching rules. Integration tests cover each command.

### Phase 5 — SDRs & promotion
- [ ] `dg sdr add "<title>" --decision ... --why ... [--alt ...] [--applies-to ...] [--agent ...] [--session ...]` writes the file and indexes it
- [ ] `dg sdr list [--status open]`
- [ ] `dg sdr promote <sdr-id>` creates an ADR draft (`proposed`) with `derived_from`, sets the SDR to `promoted` with `promoted_to`, and adds the edges
- [ ] `dg sdr discard <sdr-id> [--reason]`

**Acceptance:** after promote, both files and the edges are correct, and running promote again is rejected.

### Phase 6 — AGENTS.md compile, verify, lint, graph export
- [ ] `dg compile` writes the managed block between `<!-- dg:begin -->` and `<!-- dg:end -->`. Content outside the markers is left alone, and the file is created if missing. The block contains:
  - a short usage section ("run `dg context <files>` before editing; record decisions with `dg sdr add`; MCP server: `dg mcp`")
  - a compact index of accepted rules (`ADR-0001#1 [**/*.tsx] MUST …`), trimmed to `tokenBudget`. When trimmed, it says to use `dg context` for the full list
  - deterministic output, so diffs stay clean
- [ ] `dg verify [id...] [--timeout s]` runs Verify blocks from the repo root. Prints a pass/fail table and exits non-zero on failure. Records without a Verify block are skipped
- [ ] `dg lint`:
  - schema errors, duplicate IDs, unknown link targets, supersede cycles
  - accepted records that are superseded but not marked `superseded`
  - files over the line budget
  - near-duplicate rules (normalized token Jaccard ≥ threshold) across records
  - conflicts: overlapping `applies_to` + the same normalized subject with opposite modality (MUST vs MUST NOT). Adds `conflicts_with` edges
  - `--json`, exits non-zero on errors
- [ ] `dg graph [--format mermaid|dot] [--root id] [--depth N]`

**Acceptance:** golden-file tests for compile output. Lint fixtures cover each rule. Verify reports correctly on passing, failing, and timed-out commands.

### Phase 7 — MCP (stdio)
- [ ] Shared tool definitions in `src/mcp/tools.ts`: `search`, `context`, `get`, `related`, `list`, `sdr_add`, `lint`
- [ ] `dg mcp` stdio transport
- [ ] Config snippets for Copilot CLI / VS Code, Claude Code, and Cursor (docs)
- [ ] Tests using the MCP SDK client against the server in-process

**Acceptance:** an MCP client can list the tools and get `context` results that match the CLI's.

### Phase 8 — Postgres store, server, push/pull
- [ ] Postgres `Store` implementation: same migrations, tsvector + GIN search, project scoping
- [ ] `dg serve [--db <postgres-url|sqlite-path>] [--port] [--host 127.0.0.1]`
  - HTTP API: `POST /projects/:id/push` (bulk upsert by hash), `GET /projects`, `GET /projects/:id/records`, `GET /search?q=&project=&projectType=`, `GET /context?project=&files=`, `GET /records/:project/:id/related`
  - streamable-HTTP MCP endpoint `/mcp` using the shared tools, with optional `project` / `projectType` arguments for cross-project queries
  - warns at startup when bound to anything other than localhost (no auth in v1)
- [ ] `dg push [--remote url]` / `dg pull [--remote url] [--project ...]` (pull imports read-only into a separate namespace and never writes into the repo's files)
- [ ] `remote` setting in config
- [ ] Postgres integration tests run when `DG_TEST_PG_URL` is set. `docker-compose.yml` for local Postgres

**Acceptance:** two fixture repos of different project types push to one server, and a cross-project search by `projectType` returns the expected records. Re-pushing is safe (no duplicates).

### Phase 9 — Dogfood & docs
- [ ] Run `dg init --type cli-tool` in this repo
- [ ] Convert `legacy/ejs-docs/adr/0010–0018` into agent-optimized ADRs. Mark the EJS-specific ones `deprecated` or have ADR-0001 supersede them
- [ ] Write **ADR-0001: Pivot from EJS to decision-graph**
- [ ] Record SDRs for the significant implementation decisions made in Phases 1–8
- [ ] `dg lint` and `dg verify` both pass. AGENTS.md is generated
- [ ] README: concept, record formats, quickstart, command reference, MCP setup, server setup, a migration note for EJS users
- [ ] CI job runs `dg lint` and `dg verify` on this repo
- [ ] Publish to npm (manual step, `0.1.0`)

**Acceptance:** a fresh clone can run `npx decision-graph init` in an unrelated repo with existing MADR ADRs. In that repo, `dg context` returns rules and AGENTS.md is generated.

---

## 7. Risks & notes

- **better-sqlite3 is a native module.** It ships prebuilt binaries for common platforms. Document Node ≥ 20 and the build-from-source fallback.
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
