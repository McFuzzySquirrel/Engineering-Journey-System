# Research: JSON Journey Files and SQLite-First Efficiency

**Date:** 2026-04-09
**Session:** ejs-session-2026-04-09-01
**Branch:** copilot/research-findings-document
**Status:** Research — pending review

---

## Executive Summary

The hypothesis has two parts: (1) convert journey files to JSON, and (2) use the SQLite database as the primary interface for journey stories. These are related but independent ideas and should be evaluated separately. **The verdict: the SQLite-first approach is already the right design and is already built — the gap is adoption, not format. JSON journey files, however, would trade significant human-readability value for marginal or negative technical gains.**

The biggest finding of this research: **the format of the source files is not the context efficiency problem.** The context problem is always-on instruction overhead and agents reading raw files instead of querying the database. Fixing those two behaviours would deliver the efficiency gains the hypothesis is seeking — without touching the file format.

---

## 1. Current State Audit

### 1.1 Journey File Sizes (Evidence from Repository)

| File | Size | State |
|------|------|-------|
| `ejs-session-2026-04-09-01.md` | 2.7 KB | Empty scaffold |
| `ejs-session-2026-03-30-01.md` | 7.1 KB | Fully populated (research session) |
| `ejs-session-2026-03-04-01.md` | 10.6 KB | Fully populated |
| `ejs-session-2026-03-13-01.md` | 15.6 KB | Fully populated (large research) |
| `ejs-session-2026-02-10-02.md` | 18.8 KB | Fully populated (longest session) |

**Finding:** Populated journey files range from ~7KB to ~19KB. An empty scaffold is ~2.7KB. These are not large files. Reading one raw journey file is not a significant context cost — the instruction surface is.

### 1.2 The SQLite Database Already Exists

`adr-db.py` already provides:

```
python scripts/adr-db.py sync              # Index all journey + ADR files
python scripts/adr-db.py list-journeys     # Compact list (one line per session)
python scripts/adr-db.py get-journey <id>  # Full structured content
python scripts/adr-db.py summary-journeys  # Agent-friendly compact view
python scripts/adr-db.py search <query>    # Full-text search across all journeys
```

The journeys table stores: `session_id`, `author`, `date`, `repo`, `branch`, `agents_involved`, `decision_detected`, `adr_links`, `tags`, `problem_intent`, `interaction_summary`, `decisions_made`, `key_learnings`, `future_agent_guidance`. There is also an FTS5 index for full-text search.

**Finding:** The database-first architecture is already designed and built. This is not a new idea to implement — it is an existing capability that agents are not consistently using.

### 1.3 The Actual Context Cost Breakdown

| Source | Size | In context? |
|--------|------|-------------|
| `copilot-instructions.md` | ~940 words | **Yes — every interaction** |
| `ejs-journey.agent.md` | ~2,400 words | Only when @ejs-journey selected |
| Skills (3 files combined) | ~1,770 words | When Copilot auto-loads them |
| Journey template | ~430 words | When creating/editing |
| A raw journey file (avg) | ~600–1,200 words | Only when agent reads it directly |
| DB query output (`summary-journeys`) | ~50–100 words | When agent uses the DB |

**Finding:** The biggest fixed cost is the instruction surface, not the journey files. A `summary-journeys` query returns 10× less context than reading even one raw journey file.

---

## 2. JSON Journey Files — Full Evaluation

### 2.1 The Claim: JSON Would Be More Efficient

The hypothesis is: JSON files → easier machine parsing → agents use DB more → less context.

**This chain has a logical gap.** The DB query efficiency is independent of the source file format. The DB already indexes markdown files efficiently. An agent that queries `summary-journeys` gets the same compact output whether the source was JSON or markdown. The format of the source file does not change what the DB returns.

### 2.2 Would JSON Files Be Smaller?

**No. JSON is typically larger for equivalent content.**

Consider a journey's `problem_intent` section in each format:

**Markdown:**
```
# Problem / Intent
Research whether Copilot hooks could automate EJS session initialization.
Produce findings and recommendations. No code changes.
```
(~110 characters)

**JSON:**
```json
{
  "problem_intent": "Research whether Copilot hooks could automate EJS session initialization. Produce findings and recommendations. No code changes."
}
```
(~155 characters — 41% larger for this field alone)

Across a full journey file with 8–10 sections, all keys, all quotes, nested structures, and proper escaping, JSON adds meaningful overhead rather than saving it.

### 2.3 Human-Readability — A Core Value

Journey files serve two audiences: machines (DB sync, agent queries) and humans (PRs, review, audit trail). Markdown satisfies both. JSON satisfies only machines.

**Concrete problems with JSON journey files:**
- Git diffs become unreadable (JSON reordering, escaped strings, whitespace sensitivity)
- Pull request reviews lose the audit trail narrative
- Human contributors cannot easily write or edit session journeys
- Section headings (the EJS section structure) map poorly to JSON keys — context is lost
- Free-text narrative (the most valuable part of a journey) becomes an escaped string blob

### 2.4 Agent JSON Generation Reliability

Agents frequently produce invalid JSON when generating long text content — unclosed brackets, unescaped newlines in strings, missing commas. Markdown is forgiving: a missing `#` doesn't invalidate the file. Invalid JSON cannot be parsed at all.

**The failure mode for JSON is worse than for markdown.** A partially-written markdown journey is still parseable. A partially-written JSON journey is silently dropped during DB sync.

### 2.5 Tooling Migration Cost

Switching to JSON would require:
- Rewriting `parse_journey_file()` in `adr-db.py` (currently ~55 lines of robust regex + YAML parsing)
- Rewriting the journey template (currently the scaffold for hook creation)
- Updating all 4 Copilot hooks (`session-start.sh` creates markdown scaffolds)
- Updating the session-init skill, session-wrapup skill, and copilot-instructions
- All 14 existing journey files become legacy (not migrated, not queryable without a converter)

**Finding:** High migration cost, zero functional gain. The DB already solves machine querying.

### 2.6 JSONL as a Side Channel (Partially Interesting)

One variant of the hypothesis is worth considering: **JSONL (JSON Lines) as a machine-generated append-only event log alongside markdown journeys** — not replacing them. Each tool use or decision gets appended as a structured event:

```jsonl
{"ts":"2026-04-09T17:10:00Z","type":"decision","agent":"copilot","summary":"Chose Option A","reason":"..."}
{"ts":"2026-04-09T17:12:30Z","type":"interaction","human":"Requested research","outcome":"findings doc created"}
```

This would be machine-generated (hook-appended), not human-edited. It complements the human-readable markdown journey with a precise, query-friendly event stream.

**Assessment:** Interesting, but adds complexity without replacing the core problem. Worth a separate research spike if JSONL audit logs are specifically needed.

---

## 3. SQLite-First: The Right Idea, Already Built — But Not Enforced

### 3.1 What the DB Provides Today

Running `python scripts/adr-db.py summary-journeys` returns a compact, navigable view of all sessions — roughly 50–150 words total for 14 sessions. This is 10–20× more efficient than reading even one raw journey file.

The `search` command performs full-text search across all decisions, learnings, and intent across all journeys in a single fast query.

**The capability exists. The gap is that agents are instructed to query the DB but not required to, and the instructions are too long for agents to reliably follow.**

### 3.2 Why Agents Skip the DB

From the instruction surface analysis (`ejs-simplification-findings.md`):
- Always-on instructions are 112 lines / ~940 words — agents hit context limits and lose fidelity
- DB-first protocol is buried in a 15-line section, competing with many other instructions
- The DB sync (`adr-db.py sync`) must happen before any query — if hooks don't guarantee it, the DB may be stale or absent
- Sub-agents receive zero EJS instructions and have no knowledge of the DB at all

### 3.3 What Would Actually Make DB-First Work

1. **Hooks guarantee DB sync at session start** — already designed (Copilot hooks research). Without this, the DB-first protocol is unreliable because the DB may not exist or may be stale.
2. **The always-on instruction surface shrinks to ~25 lines** — the micro-instruction from Option A in `ejs-simplification-findings.md` reduces the noise-to-signal ratio so the DB-first rule is prominent.
3. **A `story` command in `adr-db.py`** — the current `summary-journeys` truncates at 300 characters, which is often not enough to understand a session. A `story` command returning a 2–3 sentence narrative per session would be more useful.
4. **Agents that query the DB get a better experience** — this creates a positive feedback loop: if the DB returns genuinely useful compact summaries, agents learn to prefer it.

---

## 4. Sizing the Efficiency Opportunity

| Intervention | Context Saved | Effort | Risk |
|-------------|---------------|--------|------|
| Shrink always-on instructions (Option A, already researched) | ~740 words per interaction | Low | Low |
| Enforce DB-first via hooks (already designed) | ~600–1,200 words per raw file read | Medium | Low |
| Add `story` command to `adr-db.py` | Better UX for DB queries | Low | None |
| Switch to JSON journey files | **0 context saved** | High | High |
| JSONL side channel (audit log) | Marginal | Medium | Medium |

The top three interventions deliver the efficiency gains the hypothesis is seeking. The fourth (JSON) does not.

---

## 5. Recommendations

### Recommendation 1: Do Not Switch Journey Files to JSON ✗

The format change does not reduce context, does not improve DB query efficiency, breaks human-readability, increases agent failure risk (invalid JSON), and requires significant tooling migration. The premise of the hypothesis — that JSON would reduce context — is not supported by the evidence.

### Recommendation 2: Enforce DB-First as the Primary Agent Interface ⭐

The SQLite database is already built and already contains what agents need. The work is behavioral enforcement, not format change:
- Hooks guarantee `adr-db.py sync` at session start (already designed in `copilot-hooks-findings.md`)
- Micro-instruction (Option A) makes DB-first a prominent, short rule rather than a buried 15-line section

### Recommendation 3: Add a `story` Command to `adr-db.py` ⭐

The current `summary-journeys` command is not rich enough to be useful for understanding a past session. A `story` command should return a human-readable narrative paragraph per session:

```
[ejs-session-2026-03-30-01] 2026-03-30
Intent: Research Copilot hooks for EJS automation.
Key decision: Hooks are complementary Layer 0 (structural) not replacement (semantic).
Learning: subagentStop is highest-value hook — addresses gap that instructions cannot fix.
ADR: None triggered.
```

This is compact, navigable, and useful. An agent could understand 14 sessions from a single DB query.

### Recommendation 4: Implement the Micro-Instruction (Already Recommended) ⭐

The micro-instruction from `ejs-simplification-findings.md` (Option A) is the single highest-ROI intervention for context efficiency. It reduces always-on instruction cost by 79% and makes the DB-first rule prominent. This session's research reinforces that recommendation — the instruction surface, not the file format, is the context problem.

### Recommendation 5: Consider JSONL Audit Logs as a Future Experiment (Optional)

If a machine-queryable event stream with timestamps and structured fields is needed in the future (e.g., for analytics, compliance, or automated ADR detection), JSONL append-only logs are worth experimenting with as a **complement** to markdown journeys — not a replacement. This should be deferred until the higher-priority interventions are complete.

---

## 6. Questions Raised and Answered

| Question | Answer |
|----------|--------|
| Would JSON journey files reduce context? | No. JSON is larger for equivalent content. File format ≠ context source. |
| Is the SQLite DB a good primary interface? | Yes — already built, already capable. Gap is adoption, not capability. |
| Why don't agents use the DB consistently? | Instructions are too long; DB sync not guaranteed; sub-agents get zero instructions. |
| What is the actual context bottleneck? | Always-on instructions (940 words) and raw file reads instead of DB queries. |
| Is there a valid role for JSON in EJS? | Possibly as JSONL audit logs (side channel), not as primary journey format. |
| What is the highest-ROI intervention? | Micro-instruction + DB-first enforcement via hooks. Already researched, ready to implement. |

---

## 7. Evidence Base

- `ejs-docs/research/ejs-simplification-findings.md` — instruction surface analysis, Option A micro-instruction
- `ejs-docs/research/copilot-hooks-findings.md` — hooks as Layer 0, DB sync guarantee design
- `scripts/adr-db.py` — current DB schema, query commands, journey parser
- `ejs-docs/journey/2026/*.md` — 14 journey files measured for size and content density
- `.github/copilot-instructions.md` — current always-on instruction surface
- EJS journey template — scaffold structure that would require migration

---

## 8. Key Learnings

**Technical:** JSON is not inherently more compact than markdown. For structured text content with free-form narrative sections, JSON encoding adds 20–50% overhead. The SQLite DB is the right efficiency layer — file format is irrelevant to what the DB returns.

**Architectural:** The EJS efficiency problem is a behavioral and instruction-surface problem, not a storage format problem. Agents need shorter, more prominent rules and guaranteed infrastructure (hooks sync the DB so it is always fresh).

**Questioning the premise:** The hypothesis assumed "JSON → machine-readable → less context." The logical chain breaks at "less context" — the DB already provides machine-readable compact output from markdown source. Adding JSON is adding a conversion step that produces no new capability.

---

## 9. If Repeating This Research

**Do this:** Start by measuring the actual context cost of each EJS component (instructions, skills, files). Then trace the agent behavior path to understand where context is actually consumed. Evidence first, then format decisions.

**Avoid this:** Don't conflate "machine-friendly format" with "less context." The DB abstraction layer is the context saver — the file format under it doesn't matter.

**Watch out for:** The appeal of format migrations ("if we just change the format, everything becomes cleaner"). Format migrations are high cost, high risk, and rarely deliver the efficiency gains that behavioral or architectural changes do.
