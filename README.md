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

Includes:
- `.github/agents/ejs-journey.agent.md` — Copilot custom agent profile (canonical)
- `.github/copilot-instructions.md` — Copilot repo-wide instructions (recommended)
- `.github/ejs-agent.md` — legacy pointer (compat)
- `ejs-docs/adr/0000-adr-template.md` — ADR template for structured journey capture
- `ejs-docs/adr/0010-engineering-journey-system-adoption.md` — example ADR
- `.github/copilot/pull_request_template.md` — PR template with EJS checks
- `ejs-docs/journey/_templates/journey-template.md` — Session Journey template
- `scripts/adr-db.py` — SQLite-backed index for ADRs and Session Journeys ([details below](#ejs-database-tool))
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
python scripts/adr-db.py summary       # Compact ADR digest (great for agent context)
python scripts/adr-db.py search "auth" # Full-text search across ADRs and journeys
```

### All commands

| Command | Description |
|---------|-------------|
| `sync` | Parse ADR and journey markdown files and upsert into the local SQLite database |
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

Agents should run `sync` at the start of a session to ensure the index is fresh, then use `summary`, `search`, or `get` to reference past decisions efficiently:

```bash
python scripts/adr-db.py sync && python scripts/adr-db.py summary
```

See [ADR 0013](ejs-docs/adr/0013-sqlite-backed-adr-index-for-agent-reference.md) for the full design rationale.

## How to Use

### Visual Overview
A quick visual flowchart to show the new flow:

```mermaid
flowchart TD
    Start([Start New Task]) --> Init[Initialize Session Journey<br/>ejs-session-YYYY-MM-DD-NNN.md]
    Init --> Metadata[Populate Initial Metadata<br/>+ Problem/Intent]
    Metadata --> Work[Work with Agent]
    
    Work --> Interact[Human ↔ Agent Interaction]
    Interact --> Auto[Agent Auto-Updates Journey]
    Auto --> Sections{What Changed?}
    
    Sections -->|Decision Made| DecSec[Update Decisions Section]
    Sections -->|Experiment Run| ExpSec[Update Experiments Section]
    Sections -->|Approach Pivot| IterSec[Update Iteration Log]
    Sections -->|Insight Gained| LearnSec[Update Learnings Section]
    
    DecSec --> MoreWork{More Work?}
    ExpSec --> MoreWork
    IterSec --> MoreWork
    LearnSec --> MoreWork
    
    MoreWork -->|Yes| Work
    MoreWork -->|No| Finalize[Finalize Session]
    
    Finalize --> Complete[Complete All Sections]
    Complete --> Extracts[Populate Machine Extracts]
    Extracts --> ADRCheck{Significant<br/>Decision?}
    
    ADRCheck -->|Yes| CreateADR[Create ADR 00XX]
    ADRCheck -->|No| NoADR[decision_detected: false]
    
    CreateADR --> Link[Link ADR ↔ Journey]
    Link --> Done([Session Complete])
    NoADR --> Done
    
    style Init fill:#d4edda
    style Auto fill:#fff3cd
    style Finalize fill:#cce5ff
    style CreateADR fill:#f8d7da
```
### Data Flows

To see the data flow of how this works both in a **single user and agent interaction** and a **multi-agent / sub-agent ineraction** check the [Session Lifecycle Patterns](https://github.com/McFuzzySquirrel/Engineering-Journey-System/blob/main/ejs-docs/session-lifecycle-patterns.md)

### New Session-Lifecycle Approach (Recommended)

1. **At session start**, initialize the Session Journey:
   - Agent creates `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
   - Initial metadata and problem/intent are captured
   - Structure is ready for continuous updates

2. **During the session**, work with your coding agent as usual:
   - Agent continuously updates the Session Journey as work progresses
   - Interactions, experiments, learnings captured in real-time
   - No need to remember details for end-of-session reconstruction

3. **At session end**, finalize the journey:
   - Agent completes all sections with coherent summaries
   - Machine extracts are populated
   - Agent drafts a numbered ADR only if a significant architecture/design decision occurred

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

### Make It “Fire” on Commit/Push

Agents can’t reliably detect `git commit`/`git push` on their own across editors and platforms. The portable way to make EJS run every time is to add lightweight git hook reminders.

This repo includes hooks that remind (and optionally block) when you commit/push without a Session Journey.

Install them (per-repo):

`./scripts/install-githooks.sh`

Windows (PowerShell):

`powershell -ExecutionPolicy Bypass -File .\scripts\install-githooks.ps1`

Behavior:
- `post-commit`: reminds if the last commit didn’t include an `ejs-docs/journey/YYYY/ejs-session-...md` file.
- `pre-push`: warns if the push doesn’t include a Session Journey file (set `EJS_ENFORCE=1` to block pushes).

Notes:
- On Windows, this relies on Git for Windows (Git Bash) to run hook scripts.

Bypass:
- `git commit --no-verify` / `git push --no-verify`
- or set `EJS_SKIP=1`

## Tooling integration (Copilot, Claude, Cursor)

EJS is tool-agnostic. For GitHub Copilot, the canonical, auto-discoverable location is:
- `.github/agents/ejs-journey.agent.md` (custom agent profile)

Legacy human-readable pointer (kept for compatibility):
- `.github/ejs-agent.md`

Different agent tools auto-load instructions from different filenames. Recommended mapping:

### GitHub Copilot (primary)

- Repo-wide instructions: `.github/copilot-instructions.md`.
- Custom agent profiles: `.github/agents/*.agent.md` (selectable from the Copilot agent dropdown).

This repo includes:
- `.github/agents/ejs-journey.agent.md`

Important: agent profiles don’t automatically trigger on `git commit`/`git push` events. They’re selected based on the chat context. For “fire on commit/push,” use the git hooks.

### Claude (e.g., Claude Code)

- Use `CLAUDE.md` at the repository root.
- Same approach: reference `.github/agents/ejs-journey.agent.md`.

### Cursor

- Use either `.cursorrules` at the repository root (common/simple), or Cursor “rules” under `cursor/rules/` (newer setups).
- Reference `.github/agents/ejs-journey.agent.md` and keep any Cursor-specific constraints separate.

## Using EJS in VS Code

If you work primarily in VS Code, you can use the same custom agent profile.

### Custom agent (recommended)

- Open GitHub Copilot Chat.
- Use the agent dropdown to select `ejs-journey`.
- If you don’t see it, use the agent dropdown → “Configure Custom Agents…” and ensure the workspace agent profile exists at `.github/agents/ejs-journey.agent.md`.

### Session management prompts

The agent profile handles session lifecycle directly. Use these prompts:

**At session start:**
- "Initialize session"
- "Let's start working on [task]"
- "Create session journey"

**During session:**
- The agent automatically updates the Session Journey as work progresses

**At session end:**
- "Wrap up this session"
- "Finalize journey"

### Commit/push reminders

VS Code doesn’t change the git hook behavior. If you copy the optional `.githooks/` + install scripts into your repo and install them, you’ll still get reminders on `git commit` and `git push`.


## Adopt EJS in another repository (copy/paste kit)

If you’re copying this into an existing repo (e.g., photo-jumper), copy the files below. This repo uses a strict, collision-resistant docs root: `ejs-docs/`.

### Minimal copy (recommended)

- `.github/agents/ejs-journey.agent.md`
- `.github/copilot-instructions.md` (recommended)
- `ejs-docs/journey/_templates/journey-template.md`
- `ejs-docs/adr/0000-adr-template.md`

Do not copy any existing `ejs-docs/journey/YYYY/` files from this starter repo into your target repo. Those are session artifacts; your target repo should generate its own.

### Optional (nice-to-have)

- `.github/copilot/pull_request_template.md` (PR checklist)
- `ejs-docs/session-lifecycle-patterns.md` (session flow reference with diagrams)
- `ejs-docs/adr/0010-engineering-journey-system-adoption.md` (example ADR)
- `scripts/adr-db.py` + `scripts/tests/test_adr_db.py` (SQLite index for ADR/journey querying)

If you copy example ADRs, treat them as reference material (not “your repo’s decisions”).

### Optional (commit/push reminders)

These make the process “fire” on `git commit`/`git push`:

- `.githooks/` (the hooks themselves)
- `scripts/install-githooks.sh`
- `scripts/install-githooks.ps1`

After copying, install hooks in the target repo:

- Linux/macOS: `./scripts/install-githooks.sh`
- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\install-githooks.ps1`

### Resulting layout (target repo)

.github/
├─ agents/
│  └─ ejs-journey.agent.md
├─ copilot/
│  └─ pull_request_template.md
└─ copilot-instructions.md
ejs-docs/
├─ adr/
│  └─ 0000-adr-template.md
└─ journey/
   └─ _templates/
      └─ journey-template.md

### What to do in GitHub web (your next step)

- Make sure the copied files are committed and merged to the target repo's default branch (so GitHub web can discover the agent).
- Start a Copilot coding session and select the `ejs-journey` custom agent.
- **At session start**, say: "Initialize session" or "Let's start working on [task]" to create the initial Session Journey.
- Work normally throughout the session. The agent will continuously update the Session Journey as you collaborate.
- **At session end**, say: "Wrap up this session" or "Finalize journey" to complete the Session Journey.
- Expect outputs under:
  - `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md` (created at start, updated throughout, finalized at end)
  - `ejs-docs/adr/NNNN-<kebab-title>.md` (only if decision rubric triggers)


