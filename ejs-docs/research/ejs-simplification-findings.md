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
- **~25 lines / ~200 words** vs. current 112 lines / ~940 words (78% reduction in always-on context)
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
| **Context efficiency** | 78% reduction in always-on instruction size (~940 → ~200 words) |
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

## 7. Next Steps (if this research is accepted)

1. **Draft** the micro-instruction block as a replacement for `copilot-instructions.md`
2. **Draft** the sub-agent fragment for inclusion in delegation prompts
3. **Simplify** the 3 skills to remove content now covered by the micro-instruction
4. **Test** with a real session to validate that agents produce equivalent-quality journeys
5. **Create ADR** documenting the simplification decision (if the rubric triggers)
6. **Update** bootstrap scripts to use the new micro-instruction

---

## Sources

- EJS Repository: All files analyzed in session ejs-session-2026-03-13-01
- [GitHub Docs: Customization Cheat Sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)
- [GitHub Docs: Custom Instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- Prior research: `ejs-docs/research/skill-vs-agent-findings.md` (2026-03-11)
