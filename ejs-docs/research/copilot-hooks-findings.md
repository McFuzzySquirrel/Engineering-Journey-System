# Research: GitHub Copilot Coding Agent Hooks for EJS Automation

**Date:** 2026-03-30
**Session:** ejs-session-2026-03-30-01
**Branch:** copilot/research-github-hooks-automation
**Status:** Research — pending review

---

## Executive Summary

GitHub Copilot Coding Agent **hooks** (`.github/hooks/*.json`) are a new platform mechanism that executes custom shell scripts at strategic points in an agent's workflow — session start/end, before/after tool use, on prompt submission, on sub-agent completion, and on error. They run synchronously, receive structured JSON input, and (for `preToolUse`) can approve or deny tool executions.

**Key Finding:** Hooks are **complementary** to the existing EJS instruction/skill/agent stack, not a replacement. They excel at *guaranteed structural automation* (file creation, DB sync, validation, audit logging) but cannot perform *semantic tasks* (writing meaningful decision rationale, understanding context, evaluating ADR rubrics). The biggest wins are in closing the **reliability gap** — ensuring session infrastructure is always initialized and validated regardless of whether the agent follows its instructions.

**Recommendation:** Adopt hooks for three high-value use cases: (1) guaranteed session initialization at `sessionStart`, (2) session completeness validation at `sessionEnd`, and (3) sub-agent output capture at `subagentStop`. Keep existing instructions, skills, and agent profile for semantic recording.

---

## 1. What Are Copilot Coding Agent Hooks?

Hooks are shell scripts triggered at defined points in an agent session. They are configured via JSON files stored in `.github/hooks/*.json` on the repository's default branch.

**Source:** [About hooks](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks) · [Using hooks](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks) · [Hooks configuration reference](https://docs.github.com/en/copilot/reference/hooks-configuration)

### Available Hook Types

| Hook | When It Fires | Input JSON Fields | Can Block? | Output Processed? |
|------|---------------|-------------------|------------|-------------------|
| `sessionStart` | New or resumed session | `timestamp`, `cwd`, `source` (`new`/`resume`/`startup`), `initialPrompt` | No | Ignored |
| `sessionEnd` | Session completes or terminates | `timestamp`, `cwd`, `reason` (`complete`/`error`/`abort`/`timeout`/`user_exit`) | No | Ignored |
| `userPromptSubmitted` | User submits a prompt | `timestamp`, `cwd`, `prompt` | No | Ignored |
| `preToolUse` | Before any tool executes | `timestamp`, `cwd`, `toolName`, `toolArgs` | **Yes** — can `deny` | `permissionDecision` + `permissionDecisionReason` |
| `postToolUse` | After tool completes | `timestamp`, `cwd`, `toolName`, `toolArgs`, `toolResult` (`resultType`, `textResultForLlm`) | No | Ignored |
| `agentStop` | Main agent finishes responding | (details per docs) | No | Ignored |
| `subagentStop` | Sub-agent completes | (details per docs) | No | Ignored |
| `errorOccurred` | Error during execution | `timestamp`, `cwd`, `error` (`message`, `name`, `stack`) | No | Ignored |

### Key Characteristics

- **Deterministic execution** — hooks run every time, regardless of whether the agent "remembers" its instructions
- **Shell-based** — Bash or PowerShell scripts; no LLM reasoning capability
- **Synchronous** — block agent execution until complete (performance-sensitive)
- **Repo-scoped** — must be on the default branch to activate
- **JSON I/O** — receive structured input via stdin, return JSON on stdout (for `preToolUse`)

---

## 2. Current EJS Automation Mechanisms

| Mechanism | Location | Trigger | Reliability | Semantic? |
|-----------|----------|---------|-------------|-----------|
| Custom instructions | `.github/copilot-instructions.md` | Always-on (every prompt) | Agent-dependent — can be ignored | Yes |
| Custom agent | `.github/agents/ejs-journey.agent.md` | Manual selection (Tier 2/3) | User-dependent — must be selected | Yes |
| Agent skills | `.github/skills/ejs-session-*/SKILL.md` | Auto-loaded when relevant | Agent-dependent — may not trigger | Yes |
| Git hooks | `.githooks/post-commit`, `.githooks/pre-push` | Git operations | Reliable once installed; requires manual install | No |
| ADR database | `scripts/adr-db.py` | Manual or via instructions | Agent-dependent — agent must run it | N/A |

### Known Gaps

1. **Reliability gap**: All EJS recording depends on the agent following instructions. Non-compliant agents (or agents with full context windows) may skip session initialization, DB sync, or journey finalization.
2. **Sub-agent gap**: Sub-agents receive zero EJS instructions when delegated to — their decisions are lost or reconstructed retroactively (identified in `ejs-simplification-findings.md`).
3. **Session boundary detection**: No guaranteed mechanism to detect when a session starts or ends — depends on agent interpreting signals in the prompt.
4. **Validation gap**: No automated check that a journey file was actually created or updated during a session.
5. **Git hooks require manual install**: `.githooks/` hooks need `scripts/install-githooks.sh` to be run per clone; easy to skip.

---

## 3. Hook-to-EJS Alignment Analysis

### 3.1 `sessionStart` → Session Initialization ⭐ HIGH VALUE

**Current state:** Session init relies on agent following instructions or `ejs-session-init` skill being auto-loaded.

**With hooks:**
- **Guaranteed** DB sync (`python scripts/adr-db.py sync`) on every session start
- **Guaranteed** journey file scaffold creation from template
- Auto-detect next sequence number for `ejs-session-YYYY-MM-DD-<seq>.md`
- Populate frontmatter fields available from environment (`date`, `repo`, `branch`)
- Pass journey file path as environment variable for downstream hooks

**What hooks CAN do:** File creation, DB sync, date/branch detection, sequence numbering
**What hooks CANNOT do:** Understand the user's initial intent, write Problem/Intent section, determine agents involved

**Assessment:** Hooks handle ~60% of session initialization (structural setup). The remaining ~40% (semantic content) still requires agent instructions/skills.

### 3.2 `sessionEnd` → Session Finalization & Validation ⭐ HIGH VALUE

**Current state:** Session wrapup relies on agent recognizing end signals and invoking `ejs-session-wrapup` skill.

**With hooks:**
- **Guaranteed** completeness validation: check that required sections are non-empty
- Validate that machine extracts are populated
- Check `decision_detected` field and verify ADR exists if `true`
- Log session end reason (`complete`, `error`, `abort`, etc.) to journey file
- Generate warning file or annotation if journey is incomplete

**What hooks CAN do:** Structural validation (section presence, field completeness), logging end metadata
**What hooks CANNOT do:** Write missing content, populate machine extracts (requires understanding session), evaluate ADR decision rubric (requires semantic judgment)

**Assessment:** Hooks provide a **safety net** — they can't finalize a journey, but they can catch incomplete ones and flag them for review.

### 3.3 `subagentStop` → Sub-Agent Capture ⭐⭐ HIGHEST VALUE

**Current state:** Critical gap. Sub-agents receive no EJS instructions. Their contributions are lost unless the parent agent retroactively reconstructs them.

**With hooks:**
- Capture sub-agent completion events with timestamps
- Log which sub-agents ran and when
- Could append structured placeholder entries to the Sub-Agent Contributions section
- Provides audit trail even when semantic capture fails

**What hooks CAN do:** Log sub-agent events, create structured placeholders, track delegation chains
**What hooks CANNOT do:** Understand what the sub-agent decided, write rationale or alternatives considered

**Assessment:** Even structural logging is a massive improvement over the current state (no capture at all). Combined with the sub-agent instruction fragment from the simplification research, this addresses the gap from two angles.

### 3.4 `userPromptSubmitted` → Interaction Logging MEDIUM VALUE

**Current state:** Agent is instructed to append interactions to the Interaction Summary section. Compliance varies.

**With hooks:**
- Log every user prompt with timestamp to a structured file (e.g., JSONL)
- Provides raw material for Interaction Summary reconstruction
- Could append `Human: <prompt>` entries to the journey file

**What hooks CAN do:** Capture exact prompts with timestamps
**What hooks CANNOT do:** Capture agent responses, outcomes, or agent attribution (those come from the agent side)

**Assessment:** Useful as a fallback/audit trail. Human prompts are half the interaction; agent responses still need agent-side capture.

### 3.5 `preToolUse` → EJS Compliance Enforcement MEDIUM VALUE

**Current state:** No enforcement mechanism. Agents can work an entire session without creating a journey file.

**With hooks:**
- Could check if a journey file exists before allowing `report_progress` or other commit-related tools
- Could enforce that edits to `ejs-docs/` follow naming conventions
- Could prevent accidental modification of templates or ADR schema

**What hooks CAN do:** Enforce structural rules (file exists, naming conventions, protected paths)
**What hooks CANNOT do:** Enforce content quality

**Assessment:** Powerful for establishing guardrails. However, blocking the agent may cause confusion or task failure. Best used for soft enforcement (logging warnings) rather than hard blocks in most cases.

### 3.6 `postToolUse` → Audit Trail LOW-MEDIUM VALUE

**Current state:** No tool usage tracking.

**With hooks:**
- Log all tool invocations and results to structured JSONL
- Track which files were created/edited during the session
- Detect when journey files or ADRs are modified (or not modified)

**What hooks CAN do:** Complete audit trail of agent actions
**What hooks CANNOT do:** Interpret why actions were taken

**Assessment:** Useful for compliance and debugging, but produces high-volume data. Best used selectively.

### 3.7 `agentStop` → Agent Response Boundary LOW VALUE

**Current state:** Not tracked.

**With hooks:**
- Detect when the main agent finishes responding
- Could trigger a journey checkpoint

**Assessment:** Limited standalone value. Session-level hooks (`sessionEnd`) are more useful.

### 3.8 `errorOccurred` → Error Tracking LOW VALUE (for EJS)

**Current state:** Errors are not tracked in EJS context.

**With hooks:**
- Log errors to the journey file's Experiments/Evidence section
- Track patterns of failures during a session

**Assessment:** Nice-to-have for session documentation but not core EJS functionality.

---

## 4. Gap Analysis: What Hooks Solve vs. What Remains

| EJS Gap | Hooks Address? | Remaining Need |
|---------|---------------|----------------|
| **Reliability of session init** | ✅ Structural setup guaranteed | Agent still needed for semantic content (intent, agents involved) |
| **Sub-agent capture** | ✅ Structural logging of events | Agent-side instruction fragment needed for semantic capture |
| **Session boundary detection** | ✅ Platform-level detection (no heuristics) | None — fully solved |
| **Validation of completeness** | ✅ Can check sections, fields, machine extracts | Cannot write missing content |
| **DB sync at session start** | ✅ Fully solved | None |
| **Git hooks require manual install** | ✅ `.github/hooks/` is auto-loaded from default branch | None — fully solved |
| **Sub-agent instruction gap** | ❌ Hooks don't inject instructions into sub-agents | Still needs sub-agent instruction fragment |
| **Semantic recording (decisions, rationale)** | ❌ Shell scripts can't reason | Still needs agent instructions/skills |
| **Machine extract population** | ❌ Requires LLM summarization | Still needs agent instructions/skills |
| **ADR rubric evaluation** | ❌ Requires judgment | Still needs agent instructions/skills |

---

## 5. Recommendations

### 5.1 Adopt Hooks as a Complementary Layer (Recommended)

**Principle:** Hooks handle structural guarantees; instructions/skills handle semantic intelligence.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0: Copilot Hooks (.github/hooks/)                    │
│  ► Guaranteed structural automation                         │
│  ► DB sync, file creation, validation, audit logging        │
│  ► Runs every time, no agent compliance needed              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Custom Instructions (.github/copilot-instructions)│
│  ► Always-on micro-instruction (~25 lines)                  │
│  ► Semantic recording (decisions, rationale, agent influence)│
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Agent Skills (.github/skills/)                    │
│  ► On-demand lifecycle workflows                            │
│  ► Session init (semantic parts), wrapup, sub-agent capture │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Custom Agent (.github/agents/ejs-journey.agent.md)│
│  ► Observer persona (Tier 2/3)                              │
│  ► Coordination and delegation                              │
└─────────────────────────────────────────────────────────────┘
```

This introduces hooks as **Layer 0** — a foundation that guarantees structural tasks happen regardless of agent behavior. The existing layers remain for semantic work.

### 5.2 Phase the Rollout

| Phase | Hooks | Risk | Effort |
|-------|-------|------|--------|
| **Phase 1** | `sessionStart` (DB sync + journey scaffold) | Low — additive, no blocking | Small — 1 hook script |
| **Phase 2** | `sessionEnd` (completeness validation) | Low — logging only, no blocking | Small — 1 hook script |
| **Phase 3** | `subagentStop` (sub-agent event logging) | Low — additive | Small — 1 hook script |
| **Phase 4** | `userPromptSubmitted` (prompt audit trail) | Low — logging only | Small — 1 hook script |
| **Phase 5** | `preToolUse` (soft enforcement) | Medium — could confuse agents if misconfigured | Medium — needs careful testing |

### 5.3 Simplify Existing Layers Where Hooks Take Over

Once hooks reliably handle structural tasks, the existing instructions and skills can be simplified:

- **`copilot-instructions.md`**: Remove DB sync instruction (hooks guarantee it). Remove journey file creation instruction (hooks handle scaffold). Focus purely on semantic recording.
- **`ejs-session-init` skill**: Shift from "create file + set metadata" to "enhance file created by hook with semantic content (intent, agents involved)." Becomes lighter.
- **`ejs-session-wrapup` skill**: No change needed — semantic finalization still requires LLM. Hook adds a validation safety net.
- **Git hooks (`.githooks/`)**: Can be retired for repos using Copilot agents — `.github/hooks/` replaces them with zero-install overhead.

---

## 6. Implementation Options

### Option A: Minimal — Session Infrastructure Only

**Scope:** `sessionStart` hook only. Handles DB sync and journey file scaffold.

**Files to create:**
```
.github/hooks/ejs-hooks.json          # Hook configuration
.github/hooks/session-start.sh        # Session start script
```

**Hook configuration sketch:**
```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "./.github/hooks/session-start.sh",
        "cwd": ".",
        "timeoutSec": 15
      }
    ]
  }
}
```

**`session-start.sh` would:**
1. Run `python scripts/adr-db.py sync`
2. Determine today's date and next sequence number
3. Copy journey template to `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
4. Populate frontmatter fields from environment (date, repo from git, branch from git)
5. Write journey file path to a well-known location (e.g., `.ejs-session-active`) for other hooks

**Pros:** Lowest risk, immediate value, solves reliability + DB sync gaps
**Cons:** No validation, no sub-agent capture, no audit trail

### Option B: Recommended — Lifecycle Bookends + Sub-Agent Capture

**Scope:** `sessionStart`, `sessionEnd`, `subagentStop`, `userPromptSubmitted` hooks.

**Files to create:**
```
.github/hooks/ejs-hooks.json          # Hook configuration
.github/hooks/session-start.sh        # Journey scaffold + DB sync
.github/hooks/session-end.sh          # Completeness validation
.github/hooks/subagent-stop.sh        # Sub-agent event logging
.github/hooks/log-prompt.sh           # Prompt audit trail
```

**Additional behaviors:**
- `session-end.sh`: Checks that key sections (Interaction Summary, Decisions Made, Machine Extracts) are non-empty. Writes a validation summary to the journey file footer or creates `.ejs-session-incomplete` marker.
- `subagent-stop.sh`: Appends a timestamped entry to the Sub-Agent Contributions section with a placeholder for the parent agent to fill in.
- `log-prompt.sh`: Appends `Human:` entries with timestamps to a JSONL audit file.

**Pros:** Closes the three biggest gaps (reliability, sub-agent capture, validation). Provides audit trail.
**Cons:** More scripts to maintain. `subagentStop` input schema details still evolving.

### Option C: Full — Lifecycle + Enforcement + Audit

**Scope:** All hooks from Option B plus `preToolUse` and `postToolUse`.

**Additional files:**
```
.github/hooks/pre-tool-check.sh       # Soft enforcement
.github/hooks/post-tool-log.sh        # Tool audit trail
```

**Additional behaviors:**
- `pre-tool-check.sh`: On `report_progress` or commit-related tools, checks that a journey file exists. If not, logs a warning (soft mode) or denies the action (strict mode, configurable via `EJS_ENFORCE` env var).
- `post-tool-log.sh`: Logs all tool invocations to `logs/ejs-tool-audit.jsonl`.

**Pros:** Maximum automation, enforcement, and auditability.
**Cons:** Highest maintenance. `preToolUse` blocking adds risk of confusing agents. Performance impact from synchronous hooks on every tool call. Needs thorough testing.

---

## 7. Comparison with Existing Mechanisms

| Aspect | Git Hooks (`.githooks/`) | Copilot Hooks (`.github/hooks/`) | Instructions/Skills |
|--------|--------------------------|----------------------------------|---------------------|
| **Installation** | Manual (`install-githooks.sh`) | Automatic (from default branch) | Automatic |
| **Trigger** | Git operations (commit, push) | Agent lifecycle events | Agent prompt processing |
| **Scope** | Local development only | Copilot agent sessions only | Copilot agent sessions only |
| **Can block actions** | Yes (pre-push) | Yes (`preToolUse` deny) | No (advisory only) |
| **Semantic capability** | None (shell scripts) | None (shell scripts) | Full LLM reasoning |
| **Reliability** | High (if installed) | **Guaranteed** (platform-managed) | Agent-dependent |
| **Works for sub-agents** | N/A | Yes (`subagentStop`) | No (sub-agents lack instructions) |
| **Maintenance** | Low (2 scripts) | Medium (4-6 scripts) | Low (markdown files) |

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Hooks slow down agent** | Medium | Agent feels sluggish | Keep hooks under 5 seconds. Use async logging (append to files). |
| **Hook script errors block agent** | Low | Session fails to start or tools fail | Exit 0 on all errors. Use `set -e` carefully. Test locally with piped JSON. |
| **Journey file scaffold conflicts with agent init** | Medium | Duplicate or conflicting journey files | Hook creates scaffold; agent detects existing file and enhances (not recreates). Update instructions to say "find or enhance existing journey file." |
| **`preToolUse` denial confuses agent** | Medium | Agent enters retry loop or fails task | Use soft enforcement (logging) by default. Reserve blocking for critical violations only. |
| **`subagentStop` schema changes** | Low | Hook breaks on new input format | Use defensive parsing (`jq -r '.field // "unknown"'`). Pin to documented fields. |
| **Default branch requirement** | Low | Hooks don't work on feature branches during development | Merge hook config to default branch first. Test with Copilot CLI locally. |

---

## 9. Interaction with Existing EJS Research

### Simplification Research (ejs-simplification-findings.md)

The micro-instruction model (Option A from that research) proposed reducing always-on instructions from ~940 to ~200 words. Hooks **amplify this simplification** — by offloading structural tasks (DB sync, file creation, validation) to hooks, the always-on instructions can focus exclusively on semantic recording, potentially reducing further to ~150 words.

### Skill vs Agent Research (skill-vs-agent-findings.md)

That research established the four-layer model (instructions → skills → agent → templates). Hooks add a **Layer 0 foundation** beneath all four. The skill/agent roles remain unchanged — they handle semantic work. Hooks handle deterministic structural work below them.

### Sub-Agent Capture (ADR 0012)

ADR 0012 established the protocol for sub-agent decision capture but acknowledged it depends on agent compliance. `subagentStop` hooks provide a **platform-enforced backstop** that logs sub-agent events even when the parent agent fails to record them.

---

## 10. Summary Decision Matrix

| Implementation Option | Gaps Closed | Effort | Risk | Recommended? |
|-----------------------|-------------|--------|------|-------------|
| **A: Minimal (sessionStart only)** | Reliability, DB sync | Low | Low | Good start |
| **B: Lifecycle + Sub-Agent** | Reliability, DB sync, validation, sub-agent capture, audit trail | Medium | Low | **⭐ Recommended** |
| **C: Full (all hooks)** | All structural gaps + enforcement | High | Medium | Future enhancement after B is proven |

**Recommendation:** Start with **Option B**. It delivers the highest value-to-effort ratio by closing the three most critical EJS gaps (session initialization reliability, session completeness validation, and sub-agent capture) while maintaining low risk. Option C can be layered on after Option B is proven in practice.

---

## Appendix: Hook Input/Output Reference

### sessionStart Input
```json
{
  "timestamp": 1704614400000,
  "cwd": "/path/to/project",
  "source": "new",
  "initialPrompt": "Create a new feature"
}
```

### sessionEnd Input
```json
{
  "timestamp": 1704618000000,
  "cwd": "/path/to/project",
  "reason": "complete"
}
```

### userPromptSubmitted Input
```json
{
  "timestamp": 1704614500000,
  "cwd": "/path/to/project",
  "prompt": "Fix the authentication bug"
}
```

### preToolUse Input/Output
```json
// Input
{
  "timestamp": 1704614600000,
  "cwd": "/path/to/project",
  "toolName": "bash",
  "toolArgs": "{\"command\":\"rm -rf dist\"}"
}
// Output (optional)
{
  "permissionDecision": "deny",
  "permissionDecisionReason": "Reason text"
}
```

### postToolUse Input
```json
{
  "timestamp": 1704614700000,
  "cwd": "/path/to/project",
  "toolName": "bash",
  "toolArgs": "{\"command\":\"npm test\"}",
  "toolResult": {
    "resultType": "success",
    "textResultForLlm": "All tests passed"
  }
}
```
