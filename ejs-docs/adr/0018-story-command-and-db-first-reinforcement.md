---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0018"
  title: Story Command and DB-First Reinforcement
  date: 2026-04-09
  status: accepted
  session_id: ejs-session-2026-04-10-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-04-10-01.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (copilot-coding-agent)
      role: research and implementation agent

context:
  repo: Engineering-Journey-System
  branch: copilot/research-findings-document
---

# Session Journey

Link to the originating session artifacts:
- ADR authoring session: `ejs-docs/journey/2026/ejs-session-2026-04-10-01.md`
- Research session: `ejs-docs/journey/2026/ejs-session-2026-04-09-01.md`
- Implementation session: `ejs-docs/journey/2026/ejs-session-2026-04-09-02.md`

# Context

A hypothesis was raised: would converting journey files from Markdown to JSON make the Engineering Journey System more efficient? Would querying the SQLite database as the primary interface for journey stories reduce agent context consumption?

The EJS already had a SQLite-backed index (`adr-db.py`) with `sync`, `list`, `get`, `search`, and `summary-journeys` commands, plus an FTS5 full-text search index. However, agents were not consistently using the DB — they sometimes read raw markdown files directly, consuming 600–1,200 words of context per journey instead of the ~50–100 words a DB query returns.

The always-on instruction surface (`copilot-instructions.md`) was ~940 words (already reduced to ~30 lines in ADR 0015), and the existing `summary-journeys` command truncated intent at 300 characters, making it insufficient for understanding session context.

---

# Session Intent

Research whether JSON journey files and SQLite-first querying would improve EJS efficiency, then implement any validated recommendations.

# Collaboration Summary

**Research session (ejs-session-2026-04-09-01):** The agent audited 14 journey files (2.7KB–18.8KB), compared JSON vs Markdown encoding (JSON is 20–50% larger for narrative text), read all existing research and the full `adr-db.py` source, and produced a comprehensive findings document. The research methodically dismantled the JSON hypothesis while identifying the real efficiency lever: making DB-first querying richer and more prominent.

**Implementation session (ejs-session-2026-04-09-02):** The agent first audited what was already implemented (micro-instructions and hooks sync — both done), identified the `story` command as the sole unimplemented recommendation, then built it with regex-based extraction helpers across 4 iterations. Updated all documentation to reference `story` as the preferred command.

---

# Decision Trigger / Significance

This ADR captures three related decisions that together reinforce the DB-first architecture as the primary agent interface to EJS history:

1. **Reject JSON format migration** — a format change that would have high cost, break human readability, and deliver no efficiency gain.
2. **Add `story` command** — fills a capability gap that made raw file reads tempting for agents.
3. **Promote `story` to top of DB lookup order** — makes the DB-first rule concrete and actionable across all documentation.

These decisions solidify the architectural principle that the SQLite database is the efficiency layer and the file format beneath it is irrelevant to agent context cost.

# Considered Options

## Option A: Convert journey files to JSON
Store journey sessions as JSON files instead of Markdown. Expected benefit: machine-friendly format → easier parsing → less context.

## Option B: Keep Markdown, add richer DB query command
Keep Markdown as the source format. Add a `story` command to `adr-db.py` that returns a rich, narrative summary (intent up to 400 chars, extracted key decision, key learning, ADR status). Promote this command as the preferred agent entry point.

## Option C: Keep Markdown, no changes
Leave the existing `summary-journeys` command (300-char truncation) as the primary DB query interface.

---

# Decision

**Adopt Option B.** Keep Markdown journey files. Add the `story` command to `adr-db.py` as the preferred agent query interface. Promote `story` to the top of the DB lookup order across all documentation (README, agent profile, session lifecycle patterns, copilot-instructions).

Explicitly reject Option A (JSON format migration).

---

# Rationale

**Why reject JSON (Option A):**
- JSON is typically 20–50% larger than Markdown for equivalent narrative text content (measured: 110 chars in Markdown → 155 chars in JSON for a single field, 41% overhead).
- JSON breaks human readability — journey files are read by humans during reviews, retrospectives, and debugging.
- Invalid JSON silently fails during DB sync; Markdown parsing is more forgiving.
- The DB abstraction layer already decouples file format from agent context cost — changing the format underneath does not change what the DB returns.
- High migration cost with zero capability gain.

**Why add `story` (Option B over C):**
- The existing `summary-journeys` truncates intent at 300 characters — insufficient for understanding session context.
- `story` returns a 5-line narrative per journey: session ID/date, intent (400 chars), key decision, key learning, ADR status.
- Also includes an ADR INDEX section with title, status, decision summary, and first learning per ADR.
- Makes DB-first genuinely preferable to raw file reads by providing richer, more useful output.
- Implemented with robust regex-based extraction helpers that handle variations in agent writing styles (plain bullets, bold markdown, multiple label formats).

**Why promote across all docs:**
- The DB-first rule was previously vague ("query DB before reading raw files") with no specific preferred command.
- Naming `story` explicitly in the lookup order, README, agent profile, and session lifecycle patterns makes the rule concrete and actionable.

---

# Consequences

### Positive
- Agents now have a single preferred command (`story`) that returns comprehensive project history in compact form.
- DB lookup order is concrete: `story` → `search` → `get` → raw file fallback.
- Research document (`ejs-docs/research/json-journey-format-findings.md`) provides evidence-based rationale that can be referenced in future format discussions.
- 205 new tests for `story` command helpers ensure extraction logic is robust.
- Blog post (`_posts/2026-04-09-how-ejs-works-and-why.markdown`) provides public documentation of EJS architecture and decisions.

### Negative / Trade-offs
- `story` command output is larger than `summary-journeys` — slightly higher context cost for agents that only need a quick list.
- Two similar commands (`summary-journeys` and `story`) may cause confusion — mitigated by clear documentation that `story` is preferred.
- Regex-based extraction is heuristic — may miss unusual formatting patterns in future journey content.

---

# Key Learnings

- **Format ≠ efficiency.** The logical chain "JSON → machine-readable → less context" breaks because the DB abstraction layer already provides machine-readable compact output regardless of source format. The file format under the DB is irrelevant to agent context cost.
- **Measure before migrating.** Measuring actual file sizes (2.7KB–18.8KB) and encoding overhead (JSON 41% larger) prevented an expensive format migration that would have made things worse.
- **Audit before implementing.** Two of three research recommendations were already implemented (micro-instructions, hooks sync). Checking current state first prevented wasted effort.
- **Bold markdown patterns vary.** `**label:**` puts the closing `**` after the colon. Regex for journey content must handle `(?:\*{1,2})?` in multiple positions.

---

# Agent Guidance

Instructions and signals for future agents:
- **Preferred command:** Always use `python scripts/adr-db.py story` as the first lookup when needing session history or project context.
- **DB lookup order:** `story` → `search` → `get` → raw markdown fallback.
- **Never propose JSON format migration** for journey files — this has been researched and rejected with evidence (see `ejs-docs/research/json-journey-format-findings.md`).
- **When adding new DB commands:** Follow the pattern of `cmd_story()` — use helper functions for extraction, handle variations in agent writing styles, test against all real sessions.
- **When updating documentation:** If a new preferred command is added, update all four locations: README.md, `.github/agents/ejs-journey.agent.md`, `ejs-docs/session-lifecycle-patterns.md`, `.github/copilot-instructions.md`.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "DB abstraction as the efficiency layer — format below is irrelevant"
    - "Regex-based content extraction with helpers for varying agent writing styles"
    - "Research-then-implement workflow across two linked sessions"
  prompts:
    - "Question the logical chain of a hypothesis — where does it break?"
    - "Measure actual sizes before proposing format migrations"
  anti_patterns:
    - "Assuming JSON is more efficient for text content"
    - "Proposing format changes without measuring whether format is the bottleneck"
    - "Vague rules without naming specific commands"
  future_considerations:
    - "JSONL as audit log side channel (deferred — possible future use, not replacement for markdown)"
    - "If story command output grows too large, consider pagination or filtering options"
```
