# Engineering Journey System (EJS)

Starter repository for the Engineering Journey System.

## Why This Exists

Traditional ADRs are great at recording the *final decision*, but modern development (especially human+AI collaboration) includes a lot of valuable context that usually disappears:

- The prompt/response trail and the “why” behind changes
- Experiments tried, evidence observed, and iterations/pivots
- Trade-offs considered but not chosen
- Agent influence vs. human overrides/corrections

EJS exists to capture that reality with **low friction** and **high auditability**:

- **One Session Journey per session** (initialized at start, updated throughout, finalized at end) to preserve collaboration + evidence + learning in real-time.
- **ADRs only when significant** (conditional, numbered) to keep the ADR ledger curated.
- A **repo-portable, tool-agnostic** structure so the same workflow works in GitHub web, VS Code, and across teams.
- **Non-competing observer model** — EJS injects silent recording into whatever agents are already active in your repo. It never competes with or overrides existing agent instructions.

Includes:
- `.github/hooks/ejs-hooks.json` — Copilot hooks config (Layer 0: guaranteed structural automation)
- `.github/hooks/` — Hook scripts for session start, session end, sub-agent capture, and prompt logging
- `.github/agents/ejs-journey.agent.md` — Copilot custom agent profile (observer + coordinator)
- `.github/copilot-instructions.md` — Compact micro-instruction (~30 lines, always-on; append to your existing instructions)
- `.github/skills/ejs-session-init/SKILL.md` — Agent skill for session initialization workflow
- `.github/skills/ejs-session-wrapup/SKILL.md` — Agent skill for session finalization workflow
- `.github/skills/ejs-sub-agent-capture/SKILL.md` — Agent skill for multi-agent contribution capture
- `ejs-docs/adr/0000-adr-template.md` — ADR template for structured journey capture
- `ejs-docs/adr/0010-engineering-journey-system-adoption.md` — example ADR
- `.github/copilot/pull_request_template.md` — PR template with EJS checks
- `ejs-docs/journey/_templates/journey-template.md` — Session Journey template
- `scripts/adr-db.py` — SQLite-backed index for ADRs and Session Journeys ([details below](#ejs-database-tool))
- `scripts/bootstrap-ejs.sh` — Bootstrap script to add EJS to any existing repo ([details below](#adopt-ejs-in-another-repository))
- `scripts/bootstrap-ejs.ps1` — PowerShell bootstrap script for Windows users ([details below](#adopt-ejs-in-another-repository))
- `game/` — 3D Asteroids game built with EJS sub-agents ([how to run](game/README.md))

## Purpose

EJS captures:
- human + AI collaboration
- learning and decision evolution
- reusable knowledge for future agents
- cross-platform engineering memory

## 3D Asteroids Game (EJS in Action)

The `game/` folder contains a fully playable **3D Asteroids** game built entirely through human + AI collaboration using EJS with sub-agents. It's a fun demonstration that the Engineering Journey System works end-to-end with multi-agent workflows — and the game is genuinely enjoyable to play!

See [`game/README.md`](game/README.md) for setup instructions and controls.

## EJS Database Tool

`scripts/adr-db.py` is a SQLite-backed index that lets agents (and humans) efficiently query ADRs and Session Journeys without reading every markdown file into context.

### Quick start

```bash
python scripts/adr-db.py sync          # Index all ADRs + journeys into .ejs.db
python scripts/adr-db.py story         # Journey narratives + ADR index (preferred for agents)
python scripts/adr-db.py search "auth" # Full-text search across ADRs and journeys
```

### All commands

| Command | Description |
|---------|-------------|
| `sync` | Parse ADR and journey markdown files and upsert into the local SQLite database |
| `story` | **Preferred.** Journey narratives + ADR index in one view — intent, key decision, learning, ADR status |
| `list` | List all ADRs (compact: id, title, status, date) |
| `get <adr_id>` | Show full details for a specific ADR |
| `search <query>` | Full-text search across all ADR **and** journey content |
| `summary` | Agent-friendly compact summary of all ADRs |
| `list-journeys` | List all Session Journeys (compact: id, date, decision status) |
| `get-journey <session_id>` | Show full details for a specific journey |
| `summary-journeys` | Agent-friendly compact summary of all journeys |

### How it works

- **Two tables** — `adrs` (18 columns) and `journeys` (16 columns) store extracted metadata and key content sections.
- **FTS5 full-text search** — virtual tables with auto-sync triggers enable fast concept-based queries across decisions, rationale, learnings, and session history.
- **No external dependencies** — uses Python stdlib `sqlite3`; PyYAML is optional for richer YAML frontmatter parsing.
- **Database is gitignored** — `.ejs.db` is a generated artifact. Run `sync` after cloning or when files change.

### Agent workflow

Agents should run `sync` at the start of a session to ensure the index is fresh, then use `story` to get the full project narrative (journey stories + ADR index in one view):

```bash
python scripts/adr-db.py sync && python scripts/adr-db.py story
```

For targeted lookups, use `search`, `summary`, or `get` to drill into specific decisions.

See [ADR 0013](ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md) for the full design rationale.

## How to Use

### Visual Overview
[A quick visual flowchart to show the new flow](https://github.com/McFuzzySquirrel/Engineering-Journey-System/blob/main/ejs-docs/session-lifecycle-patterns.md):


### Data Flows

To see the data flow of how this works both in a **single user and agent interaction** and a **multi-agent / sub-agent interaction** check the [Session Lifecycle Patterns](https://github.com/McFuzzySquirrel/Engineering-Journey-System/blob/main/ejs-docs/session-lifecycle-patterns.md)

### New Session-Lifecycle Approach (Recommended)

1. **At session start**, Copilot hooks automatically:
   - Sync the EJS database (`adr-db.py sync`)
   - Create the journey file scaffold from template with metadata populated
   - The `ejs-session-init` skill then enhances the scaffold with semantic content (problem/intent, agents involved)

2. **During the session**, work with your coding agent as usual:
   - Agent continuously updates the Session Journey as work progresses
   - Interactions, experiments, learnings captured in real-time
   - Sub-agent events are automatically logged by hooks; agents enrich with semantic detail
   - No need to remember details for end-of-session reconstruction

3. **At session end**, finalize the journey:
   - Agent completes all sections with coherent summaries
   - Machine extracts are populated
   - Agent drafts a numbered ADR only if a significant architecture/design decision occurred
   - Copilot hooks automatically validate completeness and flag incomplete sections

4. **Review and commit** artifacts:
   - Verify Session Journey completeness
   - Review ADR if created
   - Include links in PR template

### Why This Approach?

**Incremental capture throughout the session** produces better documentation than end-of-session reconstruction:
- Context preserved when fresh (not from memory)
- Accurate collaboration trail (recorded as it happens)
- Reduced end-of-session burden (most work already done)
- Higher quality documentation (real-time vs. retrospective)
- Better for multi-step/multi-agent sessions (preserves full history)

## Tooling integration (Copilot, Claude, Cursor)

EJS is tool-agnostic and **non-competing** — it layers silent recording onto whatever agents are already active. For GitHub Copilot, the canonical, auto-discoverable locations are:
- `.github/hooks/ejs-hooks.json` (Layer 0: guaranteed structural automation — DB sync, journey scaffold, validation, sub-agent logging)
- `.github/copilot-instructions.md` (compact micro-instruction, always-on — Tier 1)
- `.github/agents/ejs-journey.agent.md` (explicit invocation — Tier 2/3)
- `.github/skills/ejs-session-init/SKILL.md` (auto-loads for session initialization)
- `.github/skills/ejs-session-wrapup/SKILL.md` (auto-loads for session finalization)
- `.github/skills/ejs-sub-agent-capture/SKILL.md` (auto-loads for multi-agent workflows)

Different agent tools auto-load instructions from different filenames. Recommended mapping:

### GitHub Copilot (primary)

- Copilot hooks: `.github/hooks/*.json` (guaranteed structural automation — runs every session, no agent compliance needed).
- Repo-wide instructions: `.github/copilot-instructions.md`.
- Custom agent profiles: `.github/agents/*.agent.md` (selectable from the Copilot agent dropdown).
- Agent skills: `.github/skills/<name>/SKILL.md` (auto-loaded by Copilot when relevant to the task).

This repo includes:
- `.github/hooks/ejs-hooks.json` (hooks for session start/end, sub-agent capture, prompt logging)
- `.github/agents/ejs-journey.agent.md`
- `.github/skills/ejs-session-init/SKILL.md`
- `.github/skills/ejs-session-wrapup/SKILL.md`
- `.github/skills/ejs-sub-agent-capture/SKILL.md`

Important: Copilot hooks run automatically from the default branch — they handle structural tasks (DB sync, journey scaffold, validation). Agent profiles are selected based on the chat context. Agent skills are auto-loaded by Copilot when relevant.

### Claude (e.g., Claude Code)

- Use `CLAUDE.md` at the repository root.
- Same approach: reference `.github/agents/ejs-journey.agent.md`.

### Cursor

- Use either `.cursorrules` at the repository root (common/simple), or Cursor “rules” under `cursor/rules/` (newer setups).
- Reference `.github/agents/ejs-journey.agent.md` and keep any Cursor-specific constraints separate.

## Using EJS in VS Code

EJS supports three adoption tiers. Use whichever fits your workflow — they can be combined.

### Tier 1 — Always-On Recording (recommended, zero friction)

Append the compact EJS micro-instruction from `.github/copilot-instructions.md` to your repo's existing copilot-instructions.md. This injects silent recording behavior into **whatever agent is currently active** — no agent selection needed. Every Copilot conversation in the repo automatically records interactions, decisions, and sub-agent handoffs to the Session Journey.

- No agent switching required
- Works alongside any existing agents
- Recording happens as a side-effect of normal work

### Tier 2 — Bookend Invocation (explicit start/end)

Invoke `@ejs-journey` at session boundaries, then work with your normal agents in between:

**At session start:**
- `@ejs-journey initialize session`
- `@ejs-journey start EJS session for [task]`

**During session:**
- Work with your normal implementation agents — Tier 1 instructions ensure they record automatically

**At session end:**
- `@ejs-journey finalize session`
- `@ejs-journey wrap up`

### Tier 3 — Coordinator Mode (full observability)

- Open GitHub Copilot Chat
- Use the agent dropdown to select `ejs-journey`
- EJS acts as the primary agent, delegating implementation to sub-agents and recording everything directly
- If you don’t see it, use the agent dropdown → “Configure Custom Agents…” and ensure the workspace agent profile exists at `.github/agents/ejs-journey.agent.md`


## Using EJS with CLI Tools

EJS works with terminal-based AI assistants — GitHub Copilot CLI, Claude Code, aider, and similar tools. The same session lifecycle applies: initialize a journey at the start, update it as you work, and finalize at the end.

### General approach

Most CLI tools support a custom instructions file or system prompt. Point them at the EJS agent profile so the tool knows about the session lifecycle:

```bash
# Ensure the ADR/journey index is fresh before starting
python scripts/adr-db.py sync
```

Then start your CLI tool with EJS context and use the same session management prompts you would in an IDE:

- "Initialize session" / "Create session journey"
- "Wrap up this session" / "Finalize journey"

### GitHub Copilot CLI

[GitHub Copilot in the CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) (`gh copilot`) provides AI assistance directly in the terminal. It focuses on command suggestions and explanations rather than long-form coding sessions, so EJS integration is lighter:

- Use `gh copilot explain` or `gh copilot suggest` for quick, standalone queries — no session journey needed.
- For multi-step tasks where you're iterating on a problem, manually create a session journey and record your prompts, commands, and outcomes:

```bash
# Start a session journey manually
cp ejs-docs/journey/_templates/journey-template.md \
   ejs-docs/journey/$(date +%Y)/ejs-session-$(date +%Y-%m-%d)-001.md

# Use Copilot CLI as part of your workflow
gh copilot suggest "awk command to extract error counts from log"
gh copilot explain "git rebase --onto main feature~3 feature"

# Record what you learned in the session journey
```

### Claude Code (CLI)

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`) runs as an interactive terminal agent. It reads `CLAUDE.md` at the repository root for project instructions.

To integrate EJS:

1. Create or update `CLAUDE.md` to include the EJS silent recording contract:

```markdown
# Project Instructions

Follow the Engineering Journey System (EJS) contracts in this repo.
See `.github/agents/ejs-journey.agent.md` for the full agent profile.

As you work, silently record to the Session Journey file:
- Create/update `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
- Log each interaction as: Human: → Agent [your-name]: → Outcome:
- Record decisions with rationale and alternatives automatically
- At session end: finalize the journey and create an ADR if a significant decision was made
Run `python scripts/adr-db.py sync` at session start to refresh the index.
```

2. Start Claude Code in the repository and use the same lifecycle prompts:

```bash
cd your-repo
claude  # starts interactive session
# "Initialize session" → agent creates the journey file
# Work normally...
# "Wrap up this session" → agent finalizes
```

### Aider

[Aider](https://aider.chat/) is a terminal-based AI pair-programming tool. It doesn't auto-discover agent profiles, but you can pass EJS context via its conventions file or command-line flags:

```bash
# Option 1: Add EJS instructions to .aider.conf.yml
# Option 2: Pass context directly
aider --read .github/agents/ejs-journey.agent.md
```

Once aider has the EJS context, use the same session prompts to initialize and finalize journeys.

### Other CLI tools

For any CLI-based AI tool that supports custom instructions or system prompts:

1. **Point it at the agent profile** — feed `.github/agents/ejs-journey.agent.md` as context (via a config file, `--system-prompt` flag, or piped input).
2. **Sync the index** — run `python scripts/adr-db.py sync` before starting so the tool can query past decisions.
3. **Use the same lifecycle** — "Initialize session" at start, work normally, "Finalize journey" at end.
4. **Manual fallback** — if the tool can't create files, copy the journey template yourself and fill it in as you work:

```bash
YEAR=$(date +%Y)
mkdir -p ejs-docs/journey/$YEAR
cp ejs-docs/journey/_templates/journey-template.md \
   ejs-docs/journey/$YEAR/ejs-session-$(date +%Y-%m-%d)-001.md
# Edit the journey file as you work
```

The key principle is the same regardless of tool: **capture context incrementally while it's fresh**, not reconstructed after the fact.

## Adopt EJS in another repository

**EJS is additive and non-competing.** It does not replace your existing agents or instructions — it injects silent recording behavior alongside them.

### Bootstrap script (recommended)

The fastest way to add EJS to an existing repo:

```bash
# From a local clone of the EJS starter repo:
./scripts/bootstrap-ejs.sh /path/to/your-repo

# With all optional extras (PR template):
./scripts/bootstrap-ejs.sh --full /path/to/your-repo

# Preview what would change without modifying anything:
./scripts/bootstrap-ejs.sh --dry-run --full /path/to/your-repo
```

**Windows (PowerShell):**

```powershell
# From a local clone of the EJS starter repo:
.\scripts\bootstrap-ejs.ps1 -Target C:\repos\your-repo

# With all optional extras:
.\scripts\bootstrap-ejs.ps1 -Target C:\repos\your-repo -Full

# Preview what would change:
.\scripts\bootstrap-ejs.ps1 -Target C:\repos\your-repo -Full -DryRun
```

The script:
- Copies the Copilot hooks config, hook scripts, agent profile, agent skills, journey template, ADR template, and database tool (`adr-db.py`)
- **Appends** the EJS Recording Contract to your existing `.github/copilot-instructions.md` (does not replace it)
- Creates `logs/` directory for audit trail JSONL files
- Adds `.ejs.db`, `.ejs-session-active`, `.ejs-session-incomplete`, and `logs/*.jsonl` to `.gitignore`
- Is fully idempotent — safe to run multiple times
- Optionally copies PR template (`--with-pr`)

### Manual copy (alternative)

If you prefer to copy files manually, this repo uses a strict, collision-resistant docs root: `ejs-docs/`.

#### Minimal copy

- `.github/hooks/ejs-hooks.json` — Copilot hooks config (Layer 0: auto-creates journey files, syncs DB, validates completeness, logs sub-agent events)
- `.github/hooks/` — All four hook scripts (`session-start.sh`, `session-end.sh`, `subagent-stop.sh`, `log-prompt.sh`)
- `.github/agents/ejs-journey.agent.md` — EJS observer agent (for Tier 2 bookend invocation and Tier 3 coordinator mode)
- `.github/copilot-instructions.md` — **Append** the `## EJS Recording Contract` block to your **existing** copilot-instructions.md (do not replace it). If you don't have one, copy the whole file.
- `.github/skills/ejs-session-init/SKILL.md` — Agent skill for session initialization (auto-loaded by Copilot)
- `.github/skills/ejs-session-wrapup/SKILL.md` — Agent skill for session finalization (auto-loaded by Copilot)
- `.github/skills/ejs-sub-agent-capture/SKILL.md` — Agent skill for multi-agent workflows (auto-loaded by Copilot)
- `ejs-docs/journey/_templates/journey-template.md` — Session Journey template
- `ejs-docs/adr/0000-adr-template.md` — ADR template
- `scripts/adr-db.py` + `scripts/tests/test_adr_db.py` — SQLite index for ADR/journey querying
- `logs/.gitkeep` — Directory for audit trail JSONL files
- Add `.ejs.db`, `.ejs-session-active`, `.ejs-session-incomplete`, and `logs/*.jsonl` to `.gitignore`

Do not copy any existing `ejs-docs/journey/YYYY/` files from this starter repo into your target repo. Those are session artifacts; your target repo should generate its own.

### How the layers activate

| Layer | What to copy | How it activates | Agent selection needed? |
|-------|-------------|-----------------|------------------------|
| **Layer 0** (hooks) | `.github/hooks/ejs-hooks.json` + `.github/hooks/` | Automatically from default branch — guarantees structural tasks | No |
| **Tier 1** (always-on) | Append copilot-instructions.md block + skills | Automatically — every agent records silently; skills auto-load when relevant | No |
| **Tier 2** (bookend) | + agent profile | User says `@ejs-journey initialize/finalize` | Only at start/end |
| **Tier 3** (coordinator) | + agent profile | User selects `ejs-journey` from dropdown | Yes, for full session |

### Optional (nice-to-have)

- `.github/copilot/pull_request_template.md` (PR checklist)
- `ejs-docs/session-lifecycle-patterns.md` (session flow reference with diagrams)
- `ejs-docs/adr/0010-engineering-journey-system-adoption.md` (example ADR)

If you copy example ADRs, treat them as reference material (not “your repo’s decisions”).


### Resulting layout (target repo)

    .github/
    ├─ agents/
    │  └─ ejs-journey.agent.md
    ├─ copilot/
    │  └─ pull_request_template.md
    ├─ hooks/
    │  └─ ejs-hooks.json
    ├─ skills/
    │  ├─ ejs-session-init/
    │  │  └─ SKILL.md
    │  ├─ ejs-session-wrapup/
    │  │  └─ SKILL.md
    │  └─ ejs-sub-agent-capture/
    │     └─ SKILL.md
    └─ copilot-instructions.md
    ejs-docs/
    ├─ adr/
    │  └─ 0000-adr-template.md
    └─ journey/
       └─ _templates/
          └─ journey-template.md
    logs/
    └─ .gitkeep
    scripts/
    ├─ hooks/
    │  ├─ session-start.sh
    │  ├─ session-end.sh
    │  ├─ subagent-stop.sh
    │  └─ log-prompt.sh
    └─ adr-db.py

### What to do after copying (your next step)

- Make sure the copied files are committed and merged to the target repo's **default branch** (hooks only activate from the default branch).
- **Layer 0 (hooks) activates automatically** — Copilot hooks create journey scaffolds, sync the database, validate completeness, and log sub-agent events on every session.
- **Tier 1 activates automatically** — every Copilot conversation in the repo will silently record to Session Journey files. No agent selection needed.
- **For Tier 2**, invoke `@ejs-journey initialize session` at the start of a work session, then work with your normal agents, then invoke `@ejs-journey finalize session` at the end.
- **For Tier 3**, select `ejs-journey` from the Copilot agent dropdown and it will coordinate the full session.
- Expect outputs under:
  - `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md` (created at start, updated throughout, finalized at end)
  - `ejs-docs/adr/NNNN-<kebab-title>.md` (only if decision rubric triggers)


