---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0013"
  title: SQLite-Backed EJS Index for Agent Reference
  date: 2026-03-02
  status: accepted
  session_id: ejs-session-2026-03-02-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-02-01.md

actors:
  humans:
    - id: mcfuzzysquirrel
      role: lead-engineer
  agents:
    - id: github-copilot
      role: coding-agent
    - id: explore-agent
      role: codebase-analysis

context:
  repo: Engineering-Journey-System
  branch: copilot/add-sqlite-implementation-for-adrs
---

# Session Journey

Link to the originating session artifact:
- Session Journey: [ejs-docs/journey/2026/ejs-session-2026-03-02-01.md](../journey/2026/ejs-session-2026-03-02-01.md)

# Context

As the number of ADRs grows, agents reading all ADR markdown files to reference past decisions consumes significant context window space. A fast, structured lookup mechanism is needed so agents can efficiently query ADR metadata and content without loading entire files into context.

---

# Session Intent

Create a SQLite-backed tool to index ADR and Session Journey files, enabling agents to quickly reference past architecture decisions and session context when full-file context would be too expensive.

---

# Collaboration Summary

Human identified the need for a structured ADR lookup mechanism for context-constrained agents. Agent explored the repository to understand ADR format and project structure, then implemented a Python CLI tool with SQLite + FTS5 full-text search. Two bugs were discovered and fixed during testing (YAML octal parsing and f-string regex conflict). Code review and security scan completed cleanly.

---

# Decision Trigger / Significance

This session warranted an ADR because:
- **Creates a new datastore** — introduces SQLite as a storage and indexing layer for ADR metadata
- **Changes engineering process/workflow** — agents now have a tool to reference ADRs efficiently instead of reading all files
- **Multiple credible alternatives** — SQLite vs. JSON index vs. reading markdown directly, with meaningful trade-offs

# Considered Options

## Option A — Read All ADR Markdown Files (Status Quo)
Agents read all ADR files directly from the filesystem into their context window.

**Pros:**
- No tooling needed
- Always up-to-date with filesystem state

**Cons:**
- Consumes context window proportionally to total ADR content
- No structured search capability
- Scales poorly as ADR count grows

## Option B — JSON Flat-File Index
Generate a JSON file containing extracted ADR metadata for agents to read.

**Pros:**
- Simple format, no database dependency
- Easy to version control

**Cons:**
- No full-text search capability
- Still loads all data into context
- Manual sync process with no conflict-safe upsert
- No query optimization

## Option C — SQLite with FTS5 Full-Text Search (Chosen)
Create a Python CLI tool that parses ADR markdown, stores metadata in SQLite, and provides full-text search via FTS5.

**Pros:**
- Efficient targeted queries (get, search, summary)
- Built-in full-text search across all ADR content
- Compact output modes for context-constrained agents
- Uses Python stdlib (sqlite3) — no external dependencies beyond PyYAML
- Upsert pattern for safe re-syncing
- Automatic stale record cleanup

**Cons:**
- Requires sync step before querying
- Database file is a generated artifact (gitignored)
- PyYAML needed for full YAML frontmatter parsing

---

# Decision

Adopt **Option C: SQLite with FTS5 Full-Text Search**

### What was added:
1. **`scripts/adr-db.py`** — Python CLI tool with 8 commands:
   - `sync` — Parse ADR and journey files and upsert into SQLite database
   - `list` — List all ADRs with compact metadata
   - `get <id>` — Show full details for a specific ADR
   - `search <query>` — Full-text search across all ADR and journey content
   - `summary` — Agent-friendly compact summary of all ADRs
   - `list-journeys` — List all session journeys
   - `get-journey <id>` — Show full details for a specific journey
   - `summary-journeys` — Agent-friendly compact summary of all journeys

2. **`scripts/tests/test_adr_db.py`** — 39 unit tests covering ADR and journey parsing, database operations, and CLI commands

3. **`.gitignore`** — Added `.ejs.db` and `__pycache__/`

### Database schema:
- `adrs` table with 18 columns (metadata + key content sections)
- `adrs_fts` FTS5 virtual table for full-text search
- `journeys` table with 16 columns (metadata + key content sections)
- `journeys_fts` FTS5 virtual table for full-text search
- Auto-sync triggers (INSERT/UPDATE/DELETE) for index maintenance

---

# Rationale

**Option A** doesn't scale. As ADR count grows, loading all files into agent context becomes prohibitively expensive for simple reference lookups.

**Option B** is simpler but lacks search capability. Agents would still need to scan all entries to find relevant decisions, and the flat format provides no query optimization.

**Option C** provides the best balance of efficiency and capability. SQLite is available everywhere Python runs (stdlib), FTS5 enables concept-based searching, and the CLI commands give agents exactly the information they need in compact form. The `summary` command is specifically designed for context-constrained scenarios, providing decision + learnings + guidance in a truncated format.

---

# Consequences

### Positive
- **Reduced context consumption** — agents query specific ADRs or journeys instead of reading all files
- **Rich search capability** — full-text search across decisions, rationale, learnings, guidance, and session history
- **Agent-friendly output** — compact formats designed for context windows
- **Zero new dependencies** — uses Python stdlib (sqlite3 built-in)
- **Idempotent syncing** — upsert pattern makes re-syncing safe and efficient

### Negative / Trade-offs
- **Sync step required** — database can become stale if not synced after ADR changes
- **Generated artifact** — database file is gitignored, must be regenerated per-clone
- **PyYAML dependency** — full YAML parsing requires PyYAML (fallback exists but is limited)

### Mitigation
- Agents should run `sync` before querying
- Database regeneration is fast (< 1 second for typical ADR counts)
- PyYAML is widely available in Python environments

---

# Key Learnings

- YAML 1.1 (PyYAML) interprets zero-padded integers as octal — use raw text extraction for string IDs
- Python f-strings consume `{n,m}` regex quantifiers as format expressions — escape as `{{n,m}}`
- FTS5 content-sync triggers provide automatic index maintenance with minimal code
- A CLI tool with compact output modes is an effective way to serve context-constrained agents

---

# Agent Guidance

**Prefer:**
- Running `python scripts/adr-db.py sync` before querying to ensure fresh data
- Using `summary` for a quick overview of all decisions
- Using `search <concept>` to find relevant ADRs by topic
- Using `get <id>` for full details on a specific decision

**Avoid:**
- Querying without syncing first (stale data risk)
- Reading all ADR files directly when the database is available
- Treating the database as the source of truth (markdown files are canonical)

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - sqlite-document-index
    - fts5-full-text-search
    - yaml-frontmatter-parsing
    - agent-friendly-cli
  prompts:
    - "Sync ADR database before querying"
    - "Use summary for quick ADR overview"
  anti_patterns:
    - reading-all-files-for-metadata
    - yaml-octal-id-parsing
  future_considerations:
    - auto-sync on ADR file changes (file watcher or git hook)
    - session journey indexing (extend to journey files)
    - web API wrapper for remote agent access
```
