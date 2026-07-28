---
doc_type: architecture-blueprint
version: 1.0
repo: Engineering-Journey-System
last_updated: 2026-07-28
last_session: ejs-session-2026-07-28-01
---

# Architecture Blueprint — Engineering Journey System

> Living document — updated each session when architectural decisions are made.
> For historical context see `ejs-docs/adr/` and `ejs-docs/journey/`.

---

## System Context

**Users / Consumers:**
- Software engineers using GitHub Copilot (coding agent, cloud agent)
- Any LLM-powered coding agent operating in a repository

**External Integrations:**
- GitHub Copilot (hooks API: `sessionStart`, `sessionEnd`, `subagentStop`, `userPromptSubmitted`, `preCommit`)
- SQLite (local `.ejs.db` — gitignored)
- Optional: PyYAML for full frontmatter parsing

**System Boundaries:**
- EJS is entirely local to the repository — no external services required
- The bootstrap script (`scripts/bootstrap-ejs.sh`) is the only outbound operation (optional git clone when run via curl)
- All persistent state lives in markdown files (committed) and `.ejs.db` (local, gitignored)

---

## Component Map

| Component | Technology | Responsibility |
|---|---|---|
| **Session Hooks** | Bash scripts + `ejs-hooks.json` | Structural automation: create journey scaffolds, sync DB, validate completeness, log sub-agent events |
| **Agent Skills** | Markdown (`SKILL.md`) | Semantic instructions for LLM agents: session init, wrap-up, story building, sub-agent capture, arch blueprint, readme update |
| **Journey Files** | Markdown (`ejs-docs/journey/`) | Per-session human↔agent collaboration records |
| **ADRs** | Markdown (`ejs-docs/adr/`) | Architecture/process decisions with formal rationale |
| **Architecture Blueprint** | Markdown (`ejs-docs/architecture/architecture-blueprint.md`) | Living current-state architecture snapshot |
| **README** | Markdown (`README.md`) | Repository front door: purpose, setup, architecture summary |
| **EJS Database** | Python + SQLite (`scripts/adr-db.py`, `.ejs.db`) | Fast indexed search across ADRs and journeys for agents |
| **Knowledge Graph** | Python + JSON (`scripts/knowledge-graph.py`, `ejs-docs/knowledge-graph/index.json`) | Cross-reference index linking ADRs, architecture, README, and sessions |
| **Bootstrap Script** | Bash (`scripts/bootstrap-ejs.sh`) | Install EJS into any existing repository |
| **Pre-commit Hook** | Bash (`.github/hooks/pre-commit-doc-check.sh`) | Warn when living docs are stale relative to recent commits |

---

## Data Flows

### Flow: Session Start → Journey Scaffold

1. Copilot fires `sessionStart` hook
2. `session-start.sh` syncs `.ejs.db` via `adr-db.py sync` and `knowledge-graph.py sync`
3. `session-start.sh` scaffolds a new journey file from the template
4. Agent reads `ejs-session-init` skill and populates semantic metadata
5. Agent records interactions incrementally throughout the session

### Flow: Session End → Living Docs Update

1. Agent invokes `ejs-session-wrapup` skill
2. Skill finalises journey sections and populates machine extracts
3. Skill evaluates ADR rubric → creates ADR if warranted
4. Skill checks for architectural decisions → invokes `arch-blueprint` skill if needed
5. Skill checks for scope/setup changes → invokes `readme-updater` skill if needed
6. `knowledge-graph.py sync` rebuilds `ejs-docs/knowledge-graph/index.json`
7. Copilot fires `sessionEnd` hook → `session-end.sh` validates journey completeness

### Flow: Pre-commit Doc Freshness Check

1. Developer runs `git commit`
2. `.git/hooks/pre-commit` executes `pre-commit-doc-check.sh`
3. Script checks staleness of: Architecture Blueprint, README, ADRs
4. If any document is stale and not in the staged commit, a warning is printed with skill links
5. Commit proceeds regardless (non-blocking warn)

### Flow: Agent Knowledge Retrieval

1. Agent starts work on a new task
2. Agent queries `python scripts/knowledge-graph.py search <query>` for relevant context
3. Script returns ranked nodes (ADRs, architecture sections, recent sessions)
4. Agent uses results to avoid re-litigating past decisions

---

## Tech Decisions

| Decision | Choice | Rationale | ADR |
|---|---|---|---|
| Session recording format | Markdown files | Human-readable, git-diffable, no external tooling required | ADR-0010 |
| Database backend | SQLite | Zero-config, available everywhere, no external service | ADR-0013 |
| Hook mechanism | Copilot hooks (`ejs-hooks.json`) | Replaces git hooks; works in cloud agent environments | ADR-0016, ADR-0017 |
| Knowledge graph format | JSON file | Machine-readable, diffable, no graph DB required | — |
| Pre-commit enforcement | Warning only (non-blocking) | Avoids blocking commits; nudges without friction | — |

---

## Constraints

**Performance:**
- DB sync must complete within the Copilot hook timeout (15 s for `sessionStart`)
- Knowledge graph sync must be fast enough for the `sessionStart` hook

**Security:**
- No secrets, tokens, or credentials are ever written to journey files, ADRs, or the blueprint
- `.ejs.db` is gitignored; no sensitive query data is committed

**Scale:**
- Designed for single-repository use; not a multi-repo system
- Knowledge graph index is rebuilt from scratch on each sync (acceptable for typical repo sizes)

**Compatibility:**
- Hooks require Bash; tested on GNU/Linux and macOS
- Python 3.8+ required for `adr-db.py` and `knowledge-graph.py`
- PyYAML is optional but recommended for full frontmatter parsing

---

## Open Questions

- [ ] Should the knowledge graph index be committed to the repo or gitignored like `.ejs.db`?
- [ ] Should `knowledge-graph.py` support incremental updates (only re-parse changed files)?

---

## Recent Changes

- 2026-07-28 (`ejs-session-2026-07-28-01`): Initial blueprint created. Added knowledge graph component, pre-commit doc-check hook, arch-blueprint and readme-updater skills.
