# Research: Simplifying the EJS Instruction Surface

**Date:** 2026-03-13
**Session:** ejs-session-2026-03-13-01
**Branch:** copilot/research-journey-records-efficiency
**Status:** Research — pending review

---

## Executive Summary

The Engineering Journey System currently uses **366 lines of agent instructions** across `copilot-instructions.md` (112 lines) and three agent skills (255 lines combined), plus a **309-line agent profile** and **96-line journey template**. The always-on instructions alone consume **~940 words** of context in every agent interaction.

The user's hypothesis — that a small, portable instruction block sent to every agent and sub-agent could replace the current multi-layered system — is **viable and recommended**. The analysis below identifies significant redundancy in the current instruction surface and proposes three simplification options, with a recommendation for the "Micro-Instruction" approach.

---

## 1. Current System Complexity Analysis

### Instruction Surface Inventory

| Component | Lines | Words | Always in context? | Purpose |
|-----------|-------|-------|--------------------|---------| 
| `copilot-instructions.md` | 112 | ~940 | **Yes — every interaction** | Always-on silent recording contract |
| `ejs-journey.agent.md` | 309 | ~2,400 | Only when @ejs-journey selected | Observer persona, tiers, coordination |
| `ejs-session-init/SKILL.md` | 64 | ~420 | When Copilot loads it | Session initialization steps |
| `ejs-session-wrapup/SKILL.md` | 94 | ~650 | When Copilot loads it | Session finalization steps |
| `ejs-sub-agent-capture/SKILL.md` | 97 | ~700 | When Copilot loads it | Sub-agent handoff capture |
| `journey-template.md` | 96 | ~430 | When creating/editing journey | Template with section structure |
| `0000-adr-template.md` | 113 | ~480 | When creating ADR | ADR schema and structure |
| **Total** | **885** | **~6,020** | | |

### What Agents Actually Need to Know

Stripping away formatting, examples, anti-patterns, and procedural detail, the **essential instructions** reduce to:

1. **Find or create** a journey file at `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
2. **Append** interactions, decisions, and learnings to the appropriate sections as you work
3. **Attribute** every action to the agent that performed it
4. **When delegating** to sub-agents, record the delegation and capture their contributions
5. **At session end**, review for completeness, populate machine extracts, and evaluate whether an ADR is warranted
6. **Query the database** (`adr-db.py`) before reading raw markdown files

That's **6 core behaviors**. Everything else is elaboration, examples, or procedural detail that could live in the templates themselves.

### Redundancy Map

The following content appears in **multiple places**:

| Content | copilot-instructions.md | Skills | journey-template.md | lifecycle-patterns.md |
|---------|:-----------------------:|:------:|:-------------------:|:--------------------:|
| Interaction format (`Human: → Agent: → Outcome:`) | ✓ | ✓ | ✓ | ✓ |
| Checkpoint triggers (3+ interactions, 5+ exchanges) | ✓ | ✓ | | ✓ |
| ADR rubric (6 criteria) | ✓ (by reference) | ✓ | | ✓ |
| Machine extract names (5 extracts) | ✓ | ✓ | ✓ | ✓ |
| Sub-agent capture format | ✓ | ✓ | ✓ | ✓ |
| DB-first lookup protocol | ✓ | ✓ | | ✓ |
| Session ID format | ✓ | ✓ | ✓ | ✓ |

**Finding:** The interaction format alone is specified in 4 separate files. The checkpoint triggers appear in 3 files. This redundancy inflates the instruction surface without adding value — agents see the same information multiple times.

### Sub-Agent Blind Spot

A critical gap in the current model: **sub-agents receive zero EJS instructions**. When the main agent delegates to a `task`, `explore`, or `general-purpose` sub-agent:

- The sub-agent has no awareness of EJS or the session journey
- The sub-agent makes decisions without recording them
- The main agent must **reconstruct** the sub-agent's decisions after the fact
- Attribution and rationale are often lost or approximate

The user's intuition about sending instructions to sub-agents directly addresses this gap.

---

## 2. Core Principles That Must Be Preserved

Any simplification must preserve these non-negotiable principles:

| # | Principle | Why It Matters |
|---|-----------|----------------|
| 1 | **Journey record** — one per session, incremental | The session trail IS the core value of EJS |
| 2 | **ADR creation** — conditional, rubric-gated | Significant decisions need first-class records |
| 3 | **Agent attribution** — who did what | Accountability and traceability |
| 4 | **Sub-agent capture** — decisions, handoffs | Multi-agent work is opaque without this |
| 5 | **Agent influence** — adopted vs. rejected | Understanding human-AI collaboration dynamics |
| 6 | **Incremental capture** — not end-of-session reconstruction | Context fidelity degrades over time |

---

## 3. Simplification Options

### Option A: Micro-Instruction Model ⭐ (Recommended)

**Concept:** Replace the 112-line `copilot-instructions.md` with a **compact ~25-line instruction block** that tells every agent (and can be passed to every sub-agent) just three things: WHERE to write, WHAT to capture, and WHERE to find templates for structure.

**Proposed micro-instruction (draft):**

```markdown
## EJS Recording Contract

You are recording this session to the Engineering Journey System.

### Journey File
- Find today's journey: `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
- If none exists, create one from `ejs-docs/journey/_templates/journey-template.md`
- Session ID format: `ejs-session-YYYY-MM-DD-<seq>` (2-digit daily sequence)

### What to Record (silently, as you work)
- **Interactions**: Append to "Interaction Summary" — format: `Human: → Agent [your-name]: → Outcome:`
- **Decisions**: Append to "Decisions Made" — include reason and impact
- **Sub-agent work**: When delegating, record delegation + capture sub-agent's decisions/outcome in "Sub-Agent Contributions"
- **Agent influence**: Track in "Agent Influence" — what you suggested that was adopted vs. rejected

### Rules
- Record silently — do not ask the user for permission to record
- Attribute every entry by agent name
- Capture context incrementally — do not wait until session end
- At session end: complete all sections, populate MACHINE EXTRACTS, evaluate ADR rubric (see agent profile for criteria)

### Database
- Run `python scripts/adr-db.py sync` at session start
- Query DB before reading raw markdown files
```

**What this achieves:**
- **~25 lines / ~200 words** vs. current 112 lines / ~940 words (79% reduction in always-on context)
- All 6 core behaviors are covered
- Templates carry the structural detail (section headers, formatting guides)
- The agent profile retains the ADR rubric and coordination logic (loaded only when @ejs-journey is selected)
- Skills become optional enhancements rather than required duplications

**What changes:**
- `copilot-instructions.md` shrinks from 112 → ~25 lines
- Checkpointing rules move to the wrapup skill (loaded on demand, not always-on)
- DB-first protocol becomes a single line instead of a 15-line section
- Format examples live in the template, not in instructions

**What stays the same:**
- Journey template (templates are the source of truth for structure)
- ADR template
- Agent profile (for Tier 2/3 coordination)
- Skills (enhanced, but no longer duplicating core instructions)
- Database tool (`adr-db.py`)

**Sub-agent portability:** The micro-instruction is small enough to include in sub-agent delegation prompts:

```
"Review the auth module for security issues.

EJS: Record your decisions and findings. Append to the journey file at
ejs-docs/journey/2026/ejs-session-2026-03-13-01.md under 'Sub-Agent Contributions'.
Format: Task delegated / Decisions made / Alternatives considered / Outcome."
```

This is ~40 words — easily fits in a sub-agent prompt without consuming significant context.

### Option B: Consolidated Model

**Concept:** Merge the 3 skills into the `copilot-instructions.md` and eliminate the skills directory. All instructions live in one file, loaded always-on.

**Pros:**
- Single source of truth — no more redundancy across files
- No dependency on Copilot's skill auto-loading (which may not always fire)
- Simpler mental model: "one file has all EJS instructions"

**Cons:**
- **Increases** always-on context cost (366 lines → one large block always in context)
- Loses the on-demand loading benefit of skills
- Defeats the purpose of simplification — makes the always-on payload larger
- Doesn't address the sub-agent blind spot

**Assessment:** Addresses redundancy but increases always-on context cost. Not recommended.

### Option C: Hybrid Model

**Concept:** Use the micro-instruction as the always-on core (Option A), keep skills for detailed workflows, but add a **sub-agent instruction fragment** — a 3-4 line block that main agents automatically include when delegating.

**Proposed sub-agent fragment:**

```
EJS: Append your work to [journey-file-path] under "Sub-Agent Contributions".
Record: task, decisions (with rationale), alternatives considered, outcome.
Attribute all entries to your agent name.
```

**Pros:**
- Combines the micro-instruction's compactness with skills' on-demand detail
- Directly addresses the sub-agent blind spot
- Layered context: micro-instruction (always) → skills (on-demand) → sub-agent fragment (per-delegation)
- Backward-compatible with current structure

**Cons:**
- Still maintains three layers (instructions + skills + agent profile)
- Requires agents to remember to include the sub-agent fragment when delegating

**Assessment:** A pragmatic middle ground. Better than current state but more complex than Option A.

---

## 4. Recommendation: Option A (Micro-Instruction) + Sub-Agent Fragment from Option C

The most effective approach combines:

1. **Micro-instruction block** (~25 lines) replacing the current 112-line `copilot-instructions.md`
2. **Sub-agent instruction fragment** (~3 lines) that main agents include when delegating
3. **Templates as the source of truth** for structural detail (no change)
4. **Skills retained but simplified** — they become optional enrichment, not required duplication
5. **Agent profile retained** — for Tier 2/3 coordination (no change to scope)

### Why This Works

| Concern | How the micro-instruction addresses it |
|---------|---------------------------------------|
| **Context efficiency** | 79% reduction in always-on instruction size (~940 → ~200 words) |
| **Sub-agent capture** | Fragment can be included in delegation prompts; sub-agents write directly |
| **Redundancy** | Single source of truth: templates define structure, instructions define behavior |
| **Core principle preservation** | All 6 principles covered in ~25 lines |
| **Portability** | Small enough to embed in any agent's instructions or delegation prompt |
| **Backward compatibility** | Templates, ADR structure, DB tool, and agent profile unchanged |

### What the Instruction Hierarchy Looks Like

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Micro-Instruction (always-on, ~25 lines)            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ WHERE: journey file path + template reference            │ │
│ │ WHAT:  interactions, decisions, sub-agent work, influence │ │
│ │ RULES: silent, attributed, incremental, DB-first         │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓ on demand
┌──────────────────────────────────────────────────────────────┐
│ Layer 2: Skills (loaded when relevant, ~3 skills)            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Session init: create file, sync DB, populate metadata    │ │
│ │ Session wrapup: finalize, machine extracts, ADR rubric   │ │
│ │ Sub-agent capture: handoff chains, attribution protocol  │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓ per delegation
┌──────────────────────────────────────────────────────────────┐
│ Layer 3: Sub-Agent Fragment (~3 lines, included in prompts)  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ "Append to [path] under Sub-Agent Contributions.         │ │
│ │  Record: task, decisions, alternatives, outcome.          │ │
│ │  Attribute to your agent name."                           │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓ reference only
┌──────────────────────────────────────────────────────────────┐
│ Layer 4: Templates (structural source of truth)              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ journey-template.md: section headers + inline guidance   │ │
│ │ 0000-adr-template.md: ADR schema + frontmatter          │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Impact Analysis

### Context Budget Savings

| Scenario | Current (words) | Proposed (words) | Savings |
|----------|-----------------|-------------------|---------|
| Every agent interaction (always-on) | ~940 | ~200 | **79%** |
| Session with init + wrapup skills loaded | ~2,010 | ~1,270 | **37%** |
| Full Tier 3 coordinator mode | ~6,020 | ~5,280 | **12%** |

The biggest win is in the most common scenario: everyday Tier 1 always-on recording, where **every single agent interaction** carries 79% less EJS overhead.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agents don't record enough detail with shorter instructions | Medium | Medium | Templates provide structural guidance; skills provide detail when loaded |
| Sub-agent fragment not consistently included in delegations | Medium | Low | Can be automated via the agent profile's delegation protocol |
| Loss of checkpoint triggers from always-on instructions | Low | Low | Move to wrapup skill; natural checkpointing still happens via continuous updates |
| Existing journeys look different from new ones | Low | None | Template is unchanged; only instructions change |

### What Does NOT Change

- Journey template structure and sections
- ADR template and schema
- Database tool (`adr-db.py`) and DB-first protocol
- Agent profile (for Tier 2/3)
- Three-tier adoption model
- ADR decision rubric criteria
- Existing journey files and ADRs

---

## 6. Answering the User's Question

> "Could it be as simple as having a small instruction sent to every agent and sub-agent to update a journey and add based on the templates?"

**Yes.** The analysis confirms that:

1. The current 112-line always-on instructions contain significant redundancy with skills and templates
2. The core EJS behavior can be expressed in ~25 lines (6 behaviors)
3. A ~3-line sub-agent fragment can be included in delegation prompts to close the sub-agent blind spot
4. Templates already contain the structural guidance agents need — instructions don't need to duplicate it
5. The simplification preserves all 6 core principles while reducing always-on context cost by ~79%

The key insight: **tell agents WHAT to capture and WHERE to put it; let templates define HOW it should look.** This separation of concerns eliminates the redundancy that inflates the current instruction surface.

---

## 7. Implementation Plan

This plan is structured as five phases plus a pre-implementation baseline. Each phase is independently shippable — if any phase reveals issues, work can pause without leaving the system in a broken state.

### Pre-Implementation: Snapshot Current State

Before any changes, record baseline metrics for comparison:

- [ ] Word count of `copilot-instructions.md` (currently ~940 words, 112 lines)
- [ ] Word count of each skill SKILL.md (currently ~420 + ~650 + ~700 = ~1,770 words, 255 lines)
- [ ] Run a baseline session using the current instructions and save the journey for quality comparison
- [ ] Confirm all existing tests pass: `python scripts/tests/test_adr_db.py`

---

### Phase 1: Replace `copilot-instructions.md` with Micro-Instruction

**Goal:** Reduce always-on context from ~940 words → ~200 words while preserving all 6 core behaviors.

**Files changed:**

| File | Change | Lines before → after |
|------|--------|---------------------|
| `.github/copilot-instructions.md` | **Rewrite** — replace 112-line contract with ~25-line micro-instruction | 112 → ~30 |

**Specific steps:**

1. [ ] Draft the micro-instruction block (use the draft from Section 3, Option A as starting point)
2. [ ] Preserve the header comment that links to the full agent profile (`Full agent profile: .github/agents/ejs-journey.agent.md`)
3. [ ] Ensure these 6 behaviors are covered in the new block:
   - Find/create journey file
   - Append interactions, decisions, learnings
   - Attribute by agent name
   - Record sub-agent delegations and outcomes
   - At session end: complete sections, populate machine extracts, evaluate ADR rubric
   - DB-first lookup (`adr-db.py sync` + query before reading markdown)
4. [ ] Remove content that is now redundant with templates:
   - Detailed interaction format examples (template has them)
   - Checkpoint trigger rules (move to wrapup skill)
   - Extended DB-first protocol (single line is sufficient)
   - "What You Must NOT Do" section (core rules cover this)
   - Context-Threshold Checkpointing section (move to wrapup skill)
5. [ ] Validate: new file is ≤30 lines and ≤250 words
6. [ ] Run `python scripts/tests/test_adr_db.py` — should still pass (no DB changes)

**Acceptance criteria:**
- `copilot-instructions.md` is ≤30 lines / ≤250 words
- All 6 core behaviors are explicitly stated
- No content duplicated from `journey-template.md`
- Existing tests pass

**Rollback:** `git checkout main -- .github/copilot-instructions.md`

---

### Phase 2: Simplify Skills (Remove Redundancy)

**Goal:** Skills become additive enrichment, not duplications of the micro-instruction. Remove content from skills that the micro-instruction or templates already cover.

**Files changed:**

| File | Change |
|------|--------|
| `.github/skills/ejs-session-init/SKILL.md` | Remove interaction format examples and DB protocol (covered by micro-instruction). Keep: session ID generation, file creation steps, metadata population. |
| `.github/skills/ejs-session-wrapup/SKILL.md` | Absorb checkpoint triggers from old copilot-instructions.md. Remove duplicated interaction format and DB lookup steps. Keep: finalization checklist, machine extract population, ADR rubric evaluation. |
| `.github/skills/ejs-sub-agent-capture/SKILL.md` | Remove duplicated sub-agent format (template has it). Add: the sub-agent instruction fragment (~3 lines) that main agents should include in delegation prompts. Keep: handoff chain documentation, example. |

**Specific steps:**

1. [ ] **ejs-session-init/SKILL.md**: Remove the DB-first protocol details (already a one-liner in micro-instruction). Keep the step-by-step init workflow. Expected reduction: ~15 lines.
2. [ ] **ejs-session-wrapup/SKILL.md**: Move the "Checkpoint vs. Full Finalization" table and checkpoint triggers here from the old copilot-instructions.md (this is the right home — loaded on-demand, not always-on). Remove duplicated format examples. Expected: roughly same size, but different content.
3. [ ] **ejs-sub-agent-capture/SKILL.md**: Add the sub-agent instruction fragment as a documented convention:
   ```
   ### Sub-Agent Instruction Fragment
   When delegating to a sub-agent, include this in the prompt:

   EJS: Append your work to [journey-file-path] under "Sub-Agent Contributions".
   Record: task, decisions (with rationale), alternatives considered, outcome.
   Attribute all entries to your agent name.
   ```
   Remove duplicated sub-agent section format (the journey template already defines this).
4. [ ] Verify no content is lost — every piece of removed content must exist in either the micro-instruction, a template, or another skill
5. [ ] Run `python scripts/tests/test_adr_db.py` — should still pass

**Acceptance criteria:**
- No content duplicated between micro-instruction and skills
- Checkpoint rules live in wrapup skill (not always-on)
- Sub-agent fragment is documented in the capture skill
- Every piece of content from the old instructions exists in exactly one place
- Existing tests pass

**Rollback:** `git checkout main -- .github/skills/`

---

### Phase 3: Update Supporting Files

**Goal:** Ensure bootstrap scripts, README, and documentation reflect the new simplified structure.

**Files changed:**

| File | Change |
|------|--------|
| `scripts/bootstrap-ejs.sh` | Update the `append_copilot_instructions` function to use the new micro-instruction block. Update summary messages. |
| `scripts/bootstrap-ejs.ps1` | Same changes as the bash script, in PowerShell. |
| `README.md` | Update the "What's Included" table, the "Adopt EJS" section, and the description of `copilot-instructions.md` to reflect the micro-instruction approach. |
| `ejs-docs/session-lifecycle-patterns.md` | Update the "Agent Skills Integration" section to reflect the new instruction hierarchy (micro-instruction → skills → sub-agent fragment → templates). |

**Specific steps:**

1. [ ] **bootstrap-ejs.sh**: Update the EJS block detection and append logic for the new, shorter micro-instruction. The `append_copilot_instructions` function currently looks for `## EJS Silent Recording Contract` as the marker — keep this marker or choose a new one and update detection.
2. [ ] **bootstrap-ejs.ps1**: Mirror the bash changes in PowerShell.
3. [ ] **README.md**: Update these sections:
   - "What's Included" component table: describe copilot-instructions.md as "Compact micro-instruction (~25 lines)" instead of "Always-on silent recording contract"
   - "Tier 1" description: mention micro-instruction instead of "full recording contract"
   - "Manual Setup" section: update the description of what to append
4. [ ] **session-lifecycle-patterns.md**: Update the "Agent Skills Integration" table and the instruction hierarchy description to reflect the 4-layer model (micro-instruction → skills → sub-agent fragment → templates).
5. [ ] Dry-run the bootstrap script to verify it works: `./scripts/bootstrap-ejs.sh --dry-run /tmp/test-repo`
6. [ ] Run `python scripts/tests/test_adr_db.py` — should still pass

**Acceptance criteria:**
- Bootstrap scripts correctly append the new micro-instruction (not the old 112-line block)
- README accurately describes the new structure
- Documentation is internally consistent (no references to the old "Silent Recording Contract" as a 112-line block)
- Dry-run of bootstrap produces expected output
- Existing tests pass

**Rollback:** `git checkout main -- scripts/ README.md ejs-docs/session-lifecycle-patterns.md`

---

### Phase 4: Validation Session

**Goal:** Run a real session using the new simplified instructions and compare journey quality against the baseline.

**Steps:**

1. [ ] Start a new session using the simplified `copilot-instructions.md`
2. [ ] Perform a mix of single-agent and multi-agent work (to test sub-agent fragment)
3. [ ] Wrap up the session and compare the resulting journey against the Phase 0 baseline:
   - Are all sections populated?
   - Is agent attribution present?
   - Are sub-agent contributions captured?
   - Are machine extracts populated?
4. [ ] If quality is equivalent or better: proceed to Phase 5
5. [ ] If quality degraded: identify which core behavior was missed and adjust the micro-instruction

**Acceptance criteria:**
- Journey produced with new instructions is at least as complete as baseline
- Sub-agent contributions are captured (the blind spot is closed)
- No user intervention needed for recording (silent recording still works)

---

### Phase 5: ADR Decision

**Goal:** Evaluate whether this simplification warrants an ADR (using the existing rubric).

**ADR Rubric Evaluation:**

| Criterion | Applies? | Reasoning |
|-----------|----------|-----------|
| Introduces or changes a system boundary | No | Same components, fewer words |
| Changes a public contract | **Yes** | The `copilot-instructions.md` is a public contract that all agents consume |
| Alters security, privacy, or compliance | No | No security implications |
| Requires choosing among credible alternatives | **Yes** | Three options analyzed (Micro-Instruction, Consolidated, Hybrid) |
| Has long-lived or hard-to-reverse consequences | **Yes** | Changes the always-on instruction surface for all future sessions |
| Changes engineering process or workflow | **Yes** | Fundamentally simplifies how EJS instructs agents |

**Verdict: ADR is warranted.** At least 4 of 6 criteria are met.

**Steps:**

1. [ ] Create ADR `ejs-docs/adr/0015-micro-instruction-simplification.md` using the ADR template
2. [ ] Link it to the implementation session journey
3. [ ] Update `adr_links` in the session journey frontmatter
4. [ ] Run `python scripts/adr-db.py sync` to index the new ADR

---

### Implementation Summary

| Phase | Files Changed | Estimated Effort | Can Ship Independently? |
|-------|---------------|-----------------|------------------------|
| **0: Baseline** | None (read-only) | ~5 min | N/A |
| **1: Micro-Instruction** | `copilot-instructions.md` | ~15 min | ✅ Yes — standalone improvement |
| **2: Simplify Skills** | 3 × `SKILL.md` | ~20 min | ✅ Yes — but better after Phase 1 |
| **3: Supporting Files** | Bootstrap scripts, README, lifecycle docs | ~25 min | ✅ Yes — but should follow Phase 1–2 |
| **4: Validation** | New journey file (artifact) | ~15 min | ✅ Yes — proves the changes work |
| **5: ADR** | `0015-*.md`, journey frontmatter | ~10 min | ✅ Yes — records the decision |

**Total estimated effort:** ~90 minutes across 1–2 sessions.

**Recommended execution order:** Phases 0→1→4 (validate early), then 2→3→5.

By validating after Phase 1 (the core change), we get early feedback before investing in the cascading updates in Phases 2–3.

---

## Sources

- EJS Repository: All files analyzed in session ejs-session-2026-03-13-01
- [GitHub Docs: Customization Cheat Sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)
- [GitHub Docs: Custom Instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- Prior research: `ejs-docs/research/skill-vs-agent-findings.md` (2026-03-11)
