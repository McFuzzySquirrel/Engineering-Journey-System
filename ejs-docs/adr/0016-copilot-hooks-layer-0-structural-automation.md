---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0016"
  title: Copilot Hooks as Layer 0 Structural Automation
  date: 2026-03-30
  status: accepted
  session_id: ejs-session-2026-03-30-02
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-30-02.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (Claude Sonnet 4)
      role: implementation agent

context:
  repo: Engineering-Journey-System
  branch: copilot/option-b-selection
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-30-02.md`
- Research findings: `ejs-docs/research/copilot-hooks-findings.md`

# Context

EJS recording reliability depends entirely on agents following their instructions. When agents have full
context windows, encounter errors, or simply don't comply, structural tasks — DB sync, journey file
creation, session validation — may be skipped. Sub-agents receive zero EJS context and their decisions
are lost unless the parent agent reconstructs them. There is no guaranteed mechanism to detect session
boundaries or validate that a journey file was actually produced.

GitHub introduced **Copilot Coding Agent hooks** (`.github/hooks/*.json`) — platform-managed shell
scripts that execute at defined points in an agent's lifecycle (`sessionStart`, `sessionEnd`,
`subagentStop`, `userPromptSubmitted`). They run deterministically, regardless of agent compliance,
and require no manual installation (activated from the default branch).

Research in `ejs-docs/research/copilot-hooks-findings.md` identified hooks as complementary to the
existing instruction/skill/agent stack: hooks excel at guaranteed structural automation but cannot
perform semantic tasks (writing rationale, evaluating ADR rubrics, understanding context).

---

# Session Intent

Adopt Copilot hooks as a new **Layer 0** beneath the existing EJS stack, closing the reliability gap
for structural tasks while preserving the instruction/skill/agent layers for semantic recording.

# Collaboration Summary

Research was conducted into Copilot hook capabilities, limitations, and alignment with EJS gaps.
Three implementation options were evaluated (Minimal, Recommended, Full). Option B was selected and
implemented: four hook scripts for lifecycle bookends, sub-agent capture, and prompt audit. The
existing instruction and skill layers were updated to reflect the new division of labor — hooks
handle structure, agents handle semantics.

---

# Decision Trigger / Significance

This decision meets the ADR rubric on five of six criteria:

- **Introduces a new system boundary**: Hooks are a new execution layer (shell scripts managed by
  the platform) distinct from the LLM-based instruction/skill/agent stack
- **Changes a public contract**: `.github/hooks/ejs-hooks.json` defines a new hook-to-script contract;
  the session-init skill's contract shifted from "create file + sync DB" to "enhance hook scaffold"
- **Choosing among credible alternatives**: Three options evaluated (A: Minimal, B: Recommended,
  C: Full) with meaningful trade-offs in scope, effort, and risk
- **Long-lived / hard-to-reverse consequences**: Once hooks are bootstrapped into downstream repos,
  changing the architecture requires coordinated updates; the 4-layer model becomes canonical
- **Changes engineering process/workflow**: Every future EJS session now follows hook-guaranteed
  initialization and validation instead of relying solely on agent compliance

---

# Considered Options

## Option A: Minimal — Session Infrastructure Only
`sessionStart` hook only. Handles DB sync and journey file scaffold creation.

**Pros:** Lowest risk, immediate value, solves reliability and DB sync gaps.
**Cons:** No validation at session end, no sub-agent capture, no audit trail.

## Option B: Recommended — Lifecycle Bookends + Sub-Agent Capture (chosen)
Four hooks: `sessionStart`, `sessionEnd`, `subagentStop`, `userPromptSubmitted`.

**Pros:** Closes the three biggest gaps (reliability, sub-agent capture, validation). Provides prompt
audit trail. Best value-to-effort ratio.
**Cons:** More scripts to maintain. `subagentStop` input schema may evolve.

## Option C: Full — Lifecycle + Enforcement + Audit
All hooks from Option B plus `preToolUse` and `postToolUse` for tool enforcement and audit.

**Pros:** Maximum automation, enforcement, and auditability.
**Cons:** Highest maintenance. `preToolUse` blocking risks confusing agents. Performance impact
from synchronous hooks on every tool call. Better to layer on after Option B is proven.

---

# Decision

**Adopt Option B: Lifecycle Bookends + Sub-Agent Capture.**

Four hooks are implemented via `.github/hooks/ejs-hooks.json`:

| Hook | Script | Purpose |
|------|--------|---------|
| `sessionStart` | `.github/hooks/session-start.sh` | DB sync + journey scaffold with frontmatter |
| `sessionEnd` | `.github/hooks/session-end.sh` | Completeness validation, HTML comment footer |
| `subagentStop` | `.github/hooks/subagent-stop.sh` | Timestamped placeholder in Sub-Agent Contributions + JSONL audit |
| `userPromptSubmitted` | `.github/hooks/log-prompt.sh` | Prompt audit trail to `logs/ejs-prompt-audit.jsonl` |

Cross-hook state is managed via `.ejs-session-active` (contains journey file path). All hooks exit 0
on error — they never block the agent.

The existing layers are updated to reflect the new division of labor:
- **Layer 1** (instructions): Removed manual DB sync and journey creation; points to hook-created scaffold
- **Layer 2** (skills): `ejs-session-init` shifted to semantic enrichment of hook scaffold;
  `ejs-session-wrapup` and `ejs-sub-agent-capture` note that hooks provide structural backstop
- **Layer 3** (agent): Unchanged — persona and coordination are unaffected
- **Bootstrap scripts**: Copy hooks config, 4 hook scripts, `logs/.gitkeep`; add marker files to `.gitignore`

---

# Rationale

Hooks and agents are complementary — hooks guarantee **structure**, agents provide **meaning**:

| Concern | Hooks (Layer 0) | Agents (Layers 1–3) |
|---------|-----------------|---------------------|
| DB sync | ✅ Deterministic | ❌ Agent may skip |
| Journey scaffold | ✅ Guaranteed | ❌ Depends on instructions/skills |
| Frontmatter population | ✅ From git/env | ❌ Agent may populate incorrectly |
| Problem/intent recording | ❌ No LLM reasoning | ✅ Requires understanding context |
| Decision rationale | ❌ Shell scripts | ✅ Requires semantic interpretation |
| ADR rubric evaluation | ❌ Cannot reason | ✅ Requires judgment |
| Session validation | ✅ Deterministic check | ❌ Agent may forget |
| Sub-agent events | ✅ Platform-guaranteed | ❌ Sub-agents lack instructions |

Option B was chosen over Option A because validation (`sessionEnd`) and sub-agent capture
(`subagentStop`) close the two remaining high-value gaps beyond session initialization. The prompt
audit trail (`userPromptSubmitted`) adds accountability at negligible cost.

Option C was deferred because `preToolUse` blocking carries meaningful risk (agent confusion, retry
loops) and `postToolUse` on every tool call adds performance overhead. These can be layered on after
Option B is proven in production sessions.

---

# Consequences

### Positive
- **Reliability gap closed**: Journey files are guaranteed to exist for every session, with DB sync
  and frontmatter pre-populated, regardless of agent compliance
- **Sub-agent visibility**: `subagentStop` hook logs sub-agent events even when parent agents fail
  to record them — closes the sub-agent blind spot identified in ADR 0012
- **Session validation**: `sessionEnd` hook checks that key sections are non-empty, creating
  `.ejs-session-incomplete` markers when they aren't
- **Audit trail**: Prompt history in `logs/ejs-prompt-audit.jsonl` provides a forensic record
- **Amplifies simplification**: By handling structural tasks, hooks allow instructions and skills
  to focus purely on semantic content — aligns with ADR 0015's micro-instruction direction
- **Zero-install activation**: Hooks activate automatically from the default branch, unlike git
  hooks which require manual `install-githooks.sh`

### Negative / Trade-offs
- **Increased maintenance surface**: 4 new shell scripts + JSON config (6 files total)
- **Default branch requirement**: Hooks only activate from the default branch; testing on feature
  branches requires merging hook config first or using the Copilot CLI locally
- **Platform coupling**: Hooks are specific to GitHub Copilot Coding Agent; other AI coding tools
  won't benefit (instructions/skills remain cross-platform via agentskills.io)
- **Schema evolution risk**: `subagentStop` input schema is relatively new and may change;
  mitigated with defensive parsing (`jq -r '.field // "unknown"'`)
- **Scaffold conflicts**: If an agent creates a journey file before the hook fires (unlikely but
  possible on session resume), duplicate files could appear; mitigated by checking for existing
  files before creating

---

# Key Learnings

- **Deterministic ≠ semantic**: Hooks excel at things that should happen identically every time
  (file creation, DB sync, validation). Agents excel at things that require understanding (rationale,
  decisions, context). The cleanest architecture assigns each concern to the right mechanism.
- **Layered reliability**: Adding a guaranteed Layer 0 beneath advisory Layers 1–3 creates defense
  in depth — even if the agent ignores instructions, the structural foundation is present.
- **Complementary, not competitive**: Research initially framed hooks as potential replacements for
  instructions/skills. The key insight was that they're complementary — hooks provide the skeleton,
  agents provide the substance.
- **Graceful degradation**: The exit-0-on-error pattern ensures hooks never block the agent's
  primary task. A failed hook is better than a blocked session.

---

# Addendum (2026-04-13)

A Phase 2 expansion branch (`feat/hooks-phase2`) implements the previously deferred optional hooks:
`preToolUse`, `postToolUse`, `agentStop`, and `errorOccurred`.

The branch keeps the original non-blocking principle from this ADR:
- `preToolUse` returns `allow` by default (soft enforcement only)
- audit hooks append JSONL logs only
- all hook scripts continue to exit 0 on error paths

This preserves the accepted Option B baseline while enabling controlled evaluation of Option C
capabilities in a feature branch before deciding whether to promote to default branch behavior.

---

# Agent Guidance

- **Do not recreate journey files**: The `session-start.sh` hook creates the journey scaffold.
  When the `ejs-session-init` skill activates, it should detect and enhance the existing file —
  never create a competing file.
- **Check `.ejs-session-active`**: This marker file contains the path to the current session's
  journey file. Use it to locate the correct file rather than re-deriving the path.
- **Hook scripts must exit 0**: Even on errors. Wrap risky operations in `|| true` or trap handlers.
  A hook failure should degrade gracefully, not block the agent.
- **Keep hooks under 15 seconds**: Hooks run synchronously and block the agent. Use file appends
  (not network calls) and avoid expensive operations.
- **Option C is a future enhancement**: If enforcement or per-tool auditing is needed, add
  `preToolUse` and `postToolUse` hooks as a separate iteration after Option B is validated.
- **Bootstrap propagation**: When bootstrapping EJS into other repos, the updated scripts now
  include hook config and scripts. Existing EJS repos can re-run bootstrap to pick up hooks.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "layer 0 structural automation: use platform hooks for deterministic tasks, agent instructions for semantic tasks"
    - "graceful degradation: all hooks exit 0 on error, never blocking the primary workflow"
    - "cross-hook state via marker files (.ejs-session-active) rather than environment variables"
    - "defensive JSON parsing with fallback defaults for evolving input schemas"
  prompts:
    - "when adding EJS automation: is this deterministic (hook) or semantic (instruction/skill)?"
    - "when writing hook scripts: does this exit 0 on all error paths?"
  anti_patterns:
    - "don't put LLM-dependent tasks in hooks — they can't reason about context"
    - "don't let hooks block the agent on failure — always exit 0"
    - "don't duplicate hook work in instructions/skills — check if a hook already handles it"
  future_considerations:
    - "add preToolUse / postToolUse hooks for enforcement and per-tool audit (Option C)"
    - "monitor hook execution time — if any hook exceeds 5 seconds regularly, optimize or make async"
    - "evaluate whether hooks can auto-inject sub-agent delegation fragments (closing the sub-agent instruction gap)"
```
