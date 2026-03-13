---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0015"
  title: Micro-Instruction Simplification of EJS Always-On Recording Contract
  date: 2026-03-13
  status: accepted
  session_id: ejs-session-2026-03-13-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-13-01.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (Claude Sonnet 4.6)
      role: implementation agent

context:
  repo: Engineering-Journey-System
  branch: copilot/research-journey-records-efficiency
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-13-01.md`
- Research findings: `ejs-docs/research/ejs-simplification-findings.md`

# Context

The Engineering Journey System's always-on recording contract in `.github/copilot-instructions.md`
had grown to **112 lines / ~940 words**, consuming significant context budget in every single agent
interaction. The file duplicated content that already existed in templates and skills:

- Interaction format specified in 4 separate files
- Checkpoint triggers in 3 files
- DB-first lookup protocol repeated across instructions, init skill, and lifecycle docs
- Sub-agent format duplicated across instructions, capture skill, and journey template

Additionally, sub-agents (explore, task, general-purpose) received **zero EJS instructions** when
delegated to — their decisions were lost or had to be reconstructed by the main agent after the fact.

---

# Session Intent

Replace the 112-line always-on recording contract with a compact ~30-line "micro-instruction" that
covers all 6 core EJS behaviors while eliminating redundancy. Close the sub-agent blind spot by
documenting a delegation fragment that main agents can include in sub-agent prompts.

# Collaboration Summary

Research phase (prior session) identified three options and recommended Option A + a sub-agent
fragment from Option C. This session implemented all five phases of the plan:

1. Rewrote `copilot-instructions.md` from 112 lines to 33 lines (197 words)
2. Simplified `ejs-session-init/SKILL.md` — removed redundant DB-first protocol block
3. Added Sub-Agent Instruction Fragment section to `ejs-sub-agent-capture/SKILL.md`
4. Updated bootstrap scripts (`bootstrap-ejs.sh`, `bootstrap-ejs.ps1`) — new detection marker
5. Updated `README.md` and `ejs-docs/session-lifecycle-patterns.md` to reflect the new structure

All 54 existing tests passed after every phase. No behavioral regressions.

---

# Decision Trigger / Significance

- **Changes a public contract**: `copilot-instructions.md` is consumed by all agents in every session
- **Choosing among credible alternatives**: Three options analyzed in research (Micro-Instruction, Consolidated, Hybrid)
- **Long-lived consequences**: Changes the always-on instruction surface for all future sessions
- **Changes engineering process**: Fundamentally simplifies how EJS instructs agents and introduces the sub-agent fragment convention

4 of 6 ADR rubric criteria met → ADR warranted.

# Considered Options

## Option A: Micro-Instruction Model (chosen)
Replace the 112-line contract with a ~30-line block covering 6 core behaviors. Templates and skills
carry structural detail; instructions define only WHERE, WHAT, and key RULES.

## Option B: Consolidated Model
Merge all 3 skills into `copilot-instructions.md`. Single source of truth but **increases** always-on
context cost. Defeated the purpose of simplification.

## Option C: Hybrid Model
Use the micro-instruction as always-on core (Option A) and add a sub-agent delegation fragment as a
documented convention in the capture skill.

---

# Decision

**Option A (Micro-Instruction) with the sub-agent instruction fragment from Option C.**

- `copilot-instructions.md` reduced from 112 lines (~940 words) → 33 lines (197 words)
- Sub-agent instruction fragment added to `ejs-sub-agent-capture/SKILL.md` as a copy-paste convention
- Detection marker updated from `## EJS Silent Recording Contract (Always-On)` → `## EJS Recording Contract`
- Skills simplified to remove content duplicated by the micro-instruction

---

# Rationale

The micro-instruction approach achieves a **79% reduction** in always-on context cost for Tier 1
(the most common scenario — every agent interaction in any repo using EJS). This is the highest-
leverage improvement because every single agent message carries this overhead.

Key design principle applied: **tell agents WHAT to capture and WHERE to put it; let templates define
HOW it should look.** This separation of concerns eliminates redundancy without losing any functionality.

The sub-agent fragment from Option C directly addresses the identified blind spot: sub-agents make
decisions without EJS awareness. The fragment is ~40 words — small enough to embed in any delegation
prompt without meaningful context cost.

Option B was rejected because it increases always-on context (the opposite of the goal). Option C
alone doesn't achieve the context reduction of Option A. The combined approach gives both the size
reduction and the sub-agent coverage.

---

# Consequences

### Positive
- 79% reduction in always-on context per agent interaction (~940 → ~197 words)
- Sub-agent blind spot closed via documented delegation fragment convention
- Single source of truth: instructions define behavior, templates define structure
- Skills become additive enrichment, not required duplications
- Smaller, more readable instruction block is easier to maintain and update

### Negative / Trade-offs
- **Bootstrap detection break**: Repos bootstrapped before this change have the old header
  `## EJS Silent Recording Contract (Always-On)`. The new bootstrap scripts detect
  `## EJS Recording Contract`. Those repos will re-receive the EJS block on next bootstrap if
  they run the updated script. Mitigation: users should check before bootstrapping into already-EJS repos.
- **Checkpoint triggers moved**: The explicit checkpoint rules (3+ unsaved interactions, 5+ exchanges)
  are no longer in the always-on instructions. They live in `ejs-session-wrapup/SKILL.md` (on-demand).
  Agents relying only on the micro-instruction won't see checkpoint guidance unless the wrapup skill loads.
  In practice, the "capture incrementally" rule covers the intent; the detailed triggers are a refinement.

---

# Key Learnings

- Redundancy across EJS files was measured (same content in 3–4 places) — quantifying it was essential
  for justifying the change. Without the redundancy map, the simplification could have felt arbitrary.
- The micro/macro instruction split (instructions = behavior, templates = format) is a reusable
  pattern for any agent instruction system as it scales.
- Sub-agent blind spots are a common failure mode in multi-agent systems. A tiny delegation fragment
  (~40 words) can close the gap without architectural changes. This generalizes beyond EJS.
- Testing the change in isolation (Phase 1 → validate → Phases 2–5) surfaced no issues and
  built confidence before cascading changes. Phased shipping applied correctly here.

---

# Agent Guidance

- When drafting copilot-instructions.md content in future: keep always-on blocks under 250 words.
  Structural detail belongs in templates. Procedural detail belongs in skills. Instructions = behavior.
- When delegating to sub-agents: use the Sub-Agent Instruction Fragment from
  `ejs-sub-agent-capture/SKILL.md`. Replace `[journey-file-path]` with the actual session path.
- If a future session reveals that agents miss checkpoint saves (important decisions lost at context
  limit), consider re-adding a one-line checkpoint hint to the micro-instruction rather than
  reinstating the full checkpoint section.
- The `---` separator in `copilot-instructions.md` must be preserved — bootstrap scripts use
  `sed -n '/^---$/,$ p'` to extract the EJS block for appending to other repos.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "micro-instruction pattern: behavior in instructions, format in templates, detail in skills"
    - "sub-agent delegation fragment: ~3-line block closing EJS blind spot in delegated work"
    - "phased implementation with early validation before cascading changes"
  prompts:
    - "keep always-on instructions under 250 words; move structural detail to templates"
    - "when adding content to copilot-instructions.md: ask 'is this already in a template or skill?'"
  anti_patterns:
    - "duplicating content across instructions, skills, and templates"
    - "expanding always-on context to cover edge cases that belong in on-demand skills"
  future_considerations:
    - "could the sub-agent fragment be auto-injected by the main agent via the agent profile, eliminating the manual copy step?"
    - "monitor journey quality over multiple sessions: if completeness degrades, the micro-instruction may need a targeted addition"
