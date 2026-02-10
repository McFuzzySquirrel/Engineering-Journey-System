---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: 0012
  title: Sub-Agent Decision Capture and Handoff Protocol
  date: 2026-02-10
  status: accepted
  session_id: ejs-session-2026-02-10-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-02-10-01.md

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
  branch: copilot/capture-sub-agent-decisions
  platform: github
  tools:
    - github-copilot
    - vscode
---

# Session Journey

Link to the originating session artifact:
- Session Journey: [ejs-docs/journey/2026/ejs-session-2026-02-10-01.md](../journey/2026/ejs-session-2026-02-10-01.md)

# Context

EJS already supported multi-agent scenarios — the session lifecycle patterns document included a multi-agent sequence diagram, and the journey template had an `agents_involved` metadata field and an Agent Collaboration Summary section.

However, when the main agent delegated work to sub-agents, only the **outcomes** were captured. The sub-agents' **decisions** (what approaches they chose, what alternatives they considered, what trade-offs they weighed) and their **collaboration with each other** (handoff chains where one sub-agent's output fed into another's input) were lost.

This meant that in multi-agent sessions, a significant portion of the engineering reasoning trail disappeared.

---

# Session Intent

Establish a structured protocol for capturing sub-agent decisions and inter-agent collaboration in multi-agent EJS sessions.

---

# Collaboration Summary

Human identified the gap: sub-agent decisions and inter-agent collaboration were not being captured in multi-agent processes.

Agent explored the full repository to understand the current state, confirmed the gap existed across all EJS contracts (template, agent profile, skill, lifecycle patterns, instructions), and implemented a consistent solution across all 5 files.

Code review identified an inconsistency in the initial implementation (delegation events recorded in the wrong section), which was corrected.

---

# Decision Trigger / Significance

This session warranted an ADR because:
- **Changes an engineering process/workflow** — introduces a new Sub-Agent Handoff Protocol that all agents must follow in multi-agent sessions
- **Changes a public contract** — adds a new section (Sub-Agent Contributions) to the journey template and a new machine extract (SUB_AGENT_EXTRACT)

# Considered Options

## Option A — Main Agent Consolidates (Status Quo)
Continue relying on the main agent to summarize sub-agent work in the existing Interaction Summary and Agent Collaboration Summary sections.

**Pros:**
- No template or contract changes needed
- Simpler journey structure

**Cons:**
- Sub-agent decisions (approach choices, trade-offs) lost
- Inter-agent handoff chains not tracked
- No machine-readable sub-agent data
- Reasoning trail incomplete for multi-agent sessions

## Option B — Sub-Agent Contributions Section with Handoff Protocol (Chosen)
Add a structured Sub-Agent Contributions section to the journey template, with per-agent fields for decisions, alternatives, outcomes, and handoffs. Establish a handoff protocol in the lifecycle patterns document.

**Pros:**
- Sub-agent decisions captured with rationale
- Inter-agent handoffs explicitly traced
- Machine-readable via SUB_AGENT_EXTRACT
- Clear protocol for agents to follow
- Consistent with existing EJS patterns (structured sections + machine extracts)

**Cons:**
- Slightly longer journey template
- Agents need to learn the new protocol
- Section is removable if no sub-agents were used (requires discipline)

---

# Decision

Adopt **Option B: Sub-Agent Contributions Section with Handoff Protocol**

### What was added:
1. **Journey template** — new `# Sub-Agent Contributions` section with per-agent fields (task delegated, decisions made, alternatives considered, outcome, handoff to other agents) and `SUB_AGENT_EXTRACT` machine extract
2. **Agent profile** — new `## Multi-Agent Collaboration` section with delegation protocol, sub-agent decision capture rules, inter-agent collaboration guidance
3. **Skill** — `### Capture Sub-Agent Contributions` step in continuous updates, SUB_AGENT_EXTRACT in finalization
4. **Session lifecycle patterns** — `## Sub-Agent Handoff Protocol` with step-by-step guidance, inter-agent handoff chain notation, example contributions section; updated multi-agent sequence diagram
5. **Copilot instructions** — sub-agent capture guidance in "Throughout Session" section

### Key principle:
- **Delegation events** go in Interaction Summary (chronological trail)
- **Sub-agent decisions** go in Sub-Agent Contributions (structured per-agent data)

---

# Rationale

**Option A** was insufficient because it only captured outcomes, not reasoning. In multi-agent sessions, sub-agents make meaningful decisions (e.g., a code review agent choosing security-first review over style-first, a testing agent adding edge cases based on review findings). Losing this reasoning makes the engineering trail incomplete.

**Option B** follows the existing EJS pattern: structured sections for specific data types, with corresponding machine extracts. Just as decisions get their own section and extract, sub-agent contributions now have their own section and extract.

The separation of delegation events (Interaction Summary) from sub-agent decisions (Sub-Agent Contributions) follows the same principle as separating decisions from interaction history — different data types serve different purposes.

---

# Consequences

### Positive
- **Complete reasoning trail** — sub-agent decisions captured with alternatives and rationale
- **Inter-agent traceability** — handoff chains explicitly documented
- **Machine-readable** — SUB_AGENT_EXTRACT enables automated analysis of sub-agent collaboration patterns
- **Consistent with EJS patterns** — follows the same structured section + machine extract approach
- **Actionable protocol** — agents have step-by-step guidance with examples

### Negative / Trade-offs
- **Template complexity** — journey template is longer (section can be removed if unused)
- **Learning curve** — agents need to learn when and how to populate Sub-Agent Contributions
- **Discipline required** — main agent must capture sub-agent decisions after each delegation

### Mitigation
- Template includes clear instructions and "remove if unused" guidance
- Sub-Agent Handoff Protocol has step-by-step guidance with examples
- Agent profile has explicit delegation protocol
- Skill has sub-agent capture step in continuous updates workflow

---

# Key Learnings

- Sub-agent decisions are a distinct data category from interaction events
- Inter-agent handoff chains are a formalizable pattern worth documenting
- Machine extracts should mirror journey sections for consistency
- Code review catches documentation inconsistencies (delegation recording location)
- The distinction between chronological events (Interaction Summary) and structured data (Sub-Agent Contributions) is important for clarity

---

# Agent Guidance

**Prefer:**
- Recording delegation events in Interaction Summary (chronological)
- Recording sub-agent decisions in Sub-Agent Contributions (structured per-agent)
- Asking sub-agents to report decisions + alternatives, not just outcomes
- Passing prior sub-agent output as context to subsequent sub-agents (handoff chain)
- Populating SUB_AGENT_EXTRACT at finalization

**Avoid:**
- Recording only sub-agent outcomes without their reasoning
- Skipping Sub-Agent Contributions when sub-agents were used
- Conflating delegation events with decision capture
- Treating sub-agent decisions as less important than main agent decisions

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - sub-agent-decision-capture
    - inter-agent-handoff-chain
    - structured-contribution-section
  prompts:
    - "Capture sub-agent decisions in Sub-Agent Contributions"
    - "Document the handoff chain between sub-agents"
  anti_patterns:
    - outcome-only-sub-agent-recording
    - missing-sub-agent-rationale
  future_considerations:
    - automated sub-agent contribution extraction
    - sub-agent collaboration analytics
    - cross-session sub-agent pattern analysis
```
