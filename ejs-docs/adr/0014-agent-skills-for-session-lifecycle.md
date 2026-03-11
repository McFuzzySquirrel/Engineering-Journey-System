---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0014"
  title: Agent Skills for Session Lifecycle Workflows
  date: 2026-03-11
  status: accepted
  session_id: ejs-session-2026-03-11-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-11-01.md

actors:
  humans:
    - id: user
      role: developer
  agents:
    - id: copilot
      role: implementation

context:
  repo: Engineering-Journey-System
  branch: copilot/update-relevant-documentation
---

> This ADR documents the decision to add agent skills alongside the existing custom agent and custom instructions, based on research in `ejs-docs/research/skill-vs-agent-findings.md`.

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-11-01.md`
- Research: `ejs-docs/research/skill-vs-agent-findings.md`

# Context

EJS currently uses two of the three GitHub Copilot customization mechanisms:
1. **Custom Instructions** (`.github/copilot-instructions.md`) — always-on silent recording
2. **Custom Agent** (`.github/agents/ejs-journey.agent.md`) — observer persona for Tier 2/3

The third mechanism — **Agent Skills** (`.github/skills/<name>/SKILL.md`) — was planned but not implemented. Research into how GitHub designed these mechanisms revealed that they are complementary, not alternatives, and that skills would provide meaningful benefits for EJS lifecycle workflows.

The agent profile (309 lines) contains detailed workflow steps for session initialization, finalization, and sub-agent capture that would benefit from being loadable on demand rather than always occupying context window space.

---

# Session Intent

Implement the research recommendation to add agent skills for session lifecycle workflows, making EJS use all three complementary GitHub Copilot customization mechanisms as designed.

# Collaboration Summary

Research was conducted into how GitHub defines custom agents, agent skills, and custom instructions. The findings confirmed that these mechanisms are designed to be used together, with each serving a different purpose. The recommendation to implement skills was then executed.

---

# Decision Trigger / Significance

This decision meets the ADR rubric because it:
- **Changes engineering process/workflow** — adds a new category of EJS artifacts (skills) that affect how session lifecycle workflows are loaded and executed
- **Requires choosing among credible alternatives** — agent-only vs. skills-only vs. both (chose both)
- **Has long-lived consequences** — skills become part of the standard EJS bootstrap and repository layout

# Considered Options

## Option A: Keep agent-only (status quo)
All lifecycle instructions remain embedded in the 309-line agent profile. Simple but context-inefficient — the full profile loads even when only a subset is relevant.

## Option B: Replace agent with skills
Move everything to skills and remove the agent profile. This loses the observer persona, explicit invocation (Tier 2), and coordination/delegation capabilities (Tier 3).

## Option C: Use both agent and skills (chosen)
Keep the agent for persona/coordination (Tier 2/3) and add skills for specific lifecycle workflows. Skills auto-load when Copilot recognizes relevant tasks, providing context-efficient guidance.

---

# Decision

**Use both custom agent and agent skills.** Three skills were created:
- `.github/skills/ejs-session-init/SKILL.md` — session initialization workflow
- `.github/skills/ejs-session-wrapup/SKILL.md` — session finalization workflow
- `.github/skills/ejs-sub-agent-capture/SKILL.md` — sub-agent contribution capture protocol

The existing agent profile and custom instructions remain unchanged.

---

# Rationale

GitHub explicitly designed custom instructions, custom agents, and agent skills as complementary mechanisms:

> "We recommend using custom instructions for simple instructions relevant to almost every task, and skills for more detailed instructions that Copilot should only access when relevant."
> — GitHub Docs

The combined approach provides:
1. **Separation of concerns** — Agent defines WHO (observer persona), skills define WHAT (specific workflows)
2. **Context efficiency** — Skills load only when relevant instead of always occupying context window space
3. **Automatic activation** — Skills auto-load for session init/wrapup without requiring `@ejs-journey` invocation
4. **Cross-platform portability** — Skills use the open standard (agentskills.io), compatible with Claude, Cursor, and other AI systems
5. **Tier 1 enhancement** — Skills fire automatically during always-on sessions, providing richer lifecycle guidance without agent selection

Option B was rejected because agents provide capabilities that skills cannot: persona/identity, tool restrictions, sub-agent delegation, and explicit invocation — all critical for Tier 2/3.

---

# Consequences

### Positive
- Skills auto-load for session init, wrap-up, and sub-agent capture without manual invocation
- Context window usage is reduced when skills aren't relevant
- Bootstrap scripts and documentation now include skills as a standard part of EJS
- The previously referenced but unimplemented skill (`ejs-session-wrapup/SKILL.md`) is now fulfilled
- Cross-platform compatibility improved via agentskills.io open standard

### Negative / Trade-offs
- Slightly increased maintenance surface (3 new files)
- Copilot's relevance detection may not always auto-load skills when expected (fallback to Tier 1 instructions)
- Agent Skills are a relatively new platform feature — the spec may evolve

---

# Key Learnings

- GitHub's customization mechanisms are designed as complementary layers, not either/or choices
- Skills are best for multi-step workflows that should only load when relevant
- The agent profile is best for persona, coordination, and explicit invocation
- Custom instructions are best for lightweight always-on behavior

---

# Agent Guidance

Instructions and signals for future agents:
- The three skills under `.github/skills/` provide detailed lifecycle workflow steps
- The agent profile at `.github/agents/ejs-journey.agent.md` remains the source of truth for observer persona and coordination
- Custom instructions at `.github/copilot-instructions.md` remain the always-on recording contract
- When implementing new EJS workflows, evaluate whether they belong in a skill (task-specific, auto-loadable) vs. the agent profile (persona, coordination)
- Do not duplicate skill content in the agent profile — reference the skills instead

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "Use GitHub's three customization mechanisms (instructions, agents, skills) together as complementary layers"
    - "Skills for task-specific workflows, agent for persona/coordination, instructions for always-on behavior"
  prompts:
    - "What should be a skill vs. part of the agent profile?"
    - "When should an EJS workflow auto-load vs. require explicit invocation?"
  anti_patterns:
    - "Don't put detailed multi-step workflows in custom instructions (use skills instead)"
    - "Don't remove the agent profile in favor of skills-only (loses persona and coordination)"
  future_considerations:
    - "Monitor agentskills.io spec evolution for new capabilities"
    - "Consider additional skills as EJS workflows expand (e.g., ADR creation, database sync)"
    - "Evaluate whether agent profile can be further simplified as skills mature"
```
