# Research: Skill vs Agent for the Engineering Journey System

**Date:** 2026-03-11
**Session:** ejs-session-2026-03-11-01
**Branch:** copilot/research-skill-vs-agent
**Status:** Accepted — implemented in ADR 0014

---

## Executive Summary

GitHub's Copilot platform defines **Custom Agents** and **Agent Skills** as two distinct, complementary customization mechanisms. EJS currently uses a custom agent profile (`.github/agents/ejs-journey.agent.md`) and always-on custom instructions (`.github/copilot-instructions.md`). The project also references a planned but unimplemented skill file (`.github/skills/ejs-session-wrapup/SKILL.md`).

**Recommendation:** EJS should use **both** — keep the custom agent for identity/coordination (Tier 2/3) and add agent skills for specific workflow steps (session initialization, continuous recording, session wrap-up). This is not an either/or decision; the two mechanisms serve different purposes and GitHub explicitly designed them to be complementary.

---

## 1. GitHub Platform Definitions

### Custom Agents (`.github/agents/AGENT-NAME.md`)

**Official definition:** "Specialized versions of the Copilot agent that you can tailor to your unique workflows, coding conventions, and use cases. They act like tailored teammates that follow your standards, use the right tools, and implement team-specific practices."

| Attribute | Detail |
|-----------|--------|
| **File location** | `.github/agents/AGENT-NAME.md` (repo), `agents/AGENT-NAME.md` in `.github-private` (org/enterprise) |
| **Trigger** | Manual — user selects from agent dropdown in IDE, on GitHub, or in Copilot CLI |
| **Best for** | Projects or processes with distinct stages that need specialized capabilities or strict handoffs |
| **Capabilities** | Persona/identity, tool restrictions, MCP server configs, delegation to subagents |
| **Platform support** | VS Code ✓, JetBrains P, Eclipse P, Xcode P, GitHub.com ✓, Copilot CLI ✓ |
| **Source** | [GitHub Docs — About Custom Agents](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents) |

### Agent Skills (`.github/skills/<skill-name>/SKILL.md`)

**Official definition:** "Folders of instructions, scripts, and resources that Copilot can load when relevant to improve its performance in specialized tasks."

| Attribute | Detail |
|-----------|--------|
| **File location** | `.github/skills/<skill-name>/SKILL.md` (project), `~/.copilot/skills/<skill-name>/SKILL.md` (personal) |
| **Trigger** | Automatic — Copilot chooses to load based on relevance to the user's prompt |
| **Best for** | Multi-step workflows with bundled assets that should be loaded as needed |
| **Capabilities** | Instructions, scripts, supplementary resources; injected into agent context when relevant |
| **Platform support** | VS Code ✓, JetBrains P, GitHub.com ✓, Copilot CLI ✓ |
| **Open standard** | [Agent Skills spec](https://agentskills.io) — maintained by Anthropic, cross-compatible with multiple AI systems |
| **Source** | [GitHub Docs — About Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) |

### Custom Instructions (`.github/copilot-instructions.md`)

**Official definition:** "Always-on context that automatically applies to every interaction within its defined scope."

| Attribute | Detail |
|-----------|--------|
| **File location** | `.github/copilot-instructions.md` (repo-wide), `.github/instructions/*.instructions.md` (path-specific) |
| **Trigger** | Automatic — always applied |
| **Best for** | Standards, guidelines, or expectations that apply broadly |
| **Source** | [GitHub Docs — Response Customization](https://docs.github.com/en/copilot/concepts/prompting/response-customization) |

### Key Platform Distinction (from GitHub's Cheat Sheet)

| Feature | Trigger | Purpose |
|---------|---------|---------|
| **Custom Instructions** | Automatic | Always-on context for standards and guidelines |
| **Custom Agents** | Manual selection | Specialist persona with capabilities and handoffs |
| **Agent Skills** | Automatic (Copilot chooses) | Task-specific multi-step workflows loaded when relevant |
| **Subagents** | Automatic | Runtime delegation, not user-configured |

Source: [GitHub Copilot Customization Cheat Sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)

---

## 2. How EJS Currently Uses These Mechanisms

### What EJS has today

| Mechanism | File | Status | Purpose |
|-----------|------|--------|---------|
| **Custom Agent** | `.github/agents/ejs-journey.agent.md` | ✅ Implemented (309 lines) | Observer/recorder persona with 3 tiers and 4 operating modes |
| **Custom Instructions** | `.github/copilot-instructions.md` | ✅ Implemented (80 lines) | Tier 1 always-on silent recording contract |
| **Agent Skill** | `.github/skills/ejs-session-wrapup/SKILL.md` | ❌ Referenced but not implemented | Referenced 21 times across session journeys and ADRs |

### How EJS's three tiers map to platform mechanisms

| EJS Tier | Platform Mechanism | How it Works |
|----------|--------------------|--------------|
| **Tier 1** (always-on) | Custom Instructions | `copilot-instructions.md` appended to any repo — all agents record silently |
| **Tier 2** (bookend) | Custom Agent | User invokes `@ejs-journey initialize/finalize` at session boundaries |
| **Tier 3** (coordinator) | Custom Agent | User selects `ejs-journey` as primary agent; it delegates to subagents |

---

## 3. Analysis: Agent vs Skill for EJS

### Arguments for EJS as a Custom Agent ✅ (current approach)

| Strength | Explanation |
|----------|-------------|
| **Identity/Persona** | EJS has a distinct role ("non-competing observer/recorder") that benefits from a named persona |
| **Coordination** | Tier 3 requires delegation to subagents — only agents can do this via `tools: ['agent']` and `agents: ['*']` |
| **Explicit invocation** | Tier 2 bookend requires `@ejs-journey` invocation — agents are selectable, skills are not |
| **Tool restrictions** | Agent profiles can restrict which tools are available — useful for observer-only behavior |
| **Established pattern** | 533 references across the codebase use "agent" terminology consistently |

### Limitations of the agent-only approach

| Limitation | Impact |
|------------|--------|
| **Manual selection required** | Agents must be explicitly selected — they can't auto-activate for Tier 2/3 |
| **One agent at a time** | Platform limitation: selecting `ejs-journey` replaces the current active agent |
| **No automatic task loading** | Agent profile is loaded entirely or not at all — no conditional loading based on task relevance |
| **All instructions always present** | The full 309-line agent profile is always in context, even when only a subset is needed |

### Arguments for EJS as an Agent Skill

| Strength | Explanation |
|----------|-------------|
| **Automatic activation** | Skills are loaded automatically when Copilot deems them relevant — no manual selection needed |
| **Task-specific loading** | Only loaded when needed, saving context window space |
| **Script bundling** | Skills can include scripts (e.g., `adr-db.py sync`) and resources alongside instructions |
| **Open standard** | Agent Skills spec is cross-platform (Anthropic-maintained), works with Claude, Copilot, and other AI systems |
| **Complementary to agents** | Skills work within an agent's context — they enhance rather than replace |

### Limitations of skills for EJS

| Limitation | Impact |
|------------|--------|
| **No persona/identity** | Skills are instructions, not personas — they can't "be" the EJS observer |
| **No coordination** | Skills can't delegate to subagents or coordinate multi-agent workflows |
| **Not selectable** | Users can't explicitly invoke a skill — Copilot decides when to load it |
| **Relevance-dependent** | If Copilot doesn't recognize a task as relevant, the skill won't be loaded |
| **No tool restrictions** | Skills can't restrict which tools are available during their execution |

---

## 4. Recommendation: Use Both (Agent + Skills)

### Why "both" is the right answer

GitHub designed agents and skills as **complementary mechanisms** that serve different purposes:

> *"We recommend using custom instructions for simple instructions relevant to almost every task, and skills for more detailed instructions that Copilot should only access when relevant."*
> — [GitHub Docs: Skills versus custom instructions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills)

For EJS, the mapping is:

| EJS Concern | Right Mechanism | Why |
|-------------|-----------------|-----|
| **Always-on recording** | Custom Instructions | Already works — `copilot-instructions.md` ensures all agents record silently |
| **Observer identity & coordination** | Custom Agent | Tier 2/3 need persona, explicit invocation, and subagent delegation |
| **Session initialization workflow** | Agent Skill | Multi-step workflow ("create journey file, sync DB, set metadata") that should auto-load when a session starts |
| **Session wrap-up workflow** | Agent Skill | Multi-step workflow ("complete sections, populate extracts, evaluate ADR rubric") that should auto-load at session end |
| **Sub-agent capture protocol** | Agent Skill | Specialized instructions that should only load during multi-agent workflows |

### Proposed structure

```
.github/
├── agents/
│   └── ejs-journey.agent.md          # Custom Agent: persona, tiers, coordination
│
├── copilot-instructions.md           # Custom Instructions: always-on silent recording
│
└── skills/
    ├── ejs-session-init/
    │   └── SKILL.md                  # Skill: session initialization workflow
    ├── ejs-session-wrapup/
    │   └── SKILL.md                  # Skill: session finalization workflow
    └── ejs-sub-agent-capture/
        └── SKILL.md                  # Skill: sub-agent contribution capture protocol
```

### Benefits of the combined approach

1. **Separation of concerns** — Agent defines WHO (observer persona), skills define WHAT (workflow steps)
2. **Context efficiency** — Skills load only when relevant instead of always occupying context window
3. **Automatic activation** — Skills auto-load for session init/wrapup tasks without requiring `@ejs-journey` invocation
4. **Cross-platform** — Skills use the open standard (agentskills.io), improving portability to Claude, Cursor, etc.
5. **Incremental adoption** — Skills can be added without modifying the existing agent profile or custom instructions
6. **Tier 1 enhancement** — Skills can fire automatically during Tier 1 (always-on) sessions when Copilot recognizes relevant tasks, giving richer workflow guidance without requiring agent selection

### What stays as-is

- **`.github/agents/ejs-journey.agent.md`** — Keep the agent profile for Tier 2/3 coordination and observer persona
- **`.github/copilot-instructions.md`** — Keep the always-on silent recording contract for Tier 1
- **Three-tier adoption model** — The tiers remain valid; skills enhance each tier

### What changes

- **Add `.github/skills/`** — Create skill folders for session lifecycle workflows
- **Move workflow steps from agent profile to skills** — The agent profile references skills for specific workflows instead of embedding all instructions
- **Resolve the planned `SKILL.md` reference** — The 21 references to the unimplemented skill can now be fulfilled
- **Update documentation** — README, session lifecycle patterns, and bootstrap scripts would need to include skills

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Copilot doesn't auto-load EJS skills when expected | Medium | Medium | Skills have `description` fields that guide relevance matching; fallback to Tier 1 instructions |
| Skills spec changes (it's relatively new) | Low | Low | Skills use simple SKILL.md format; easy to adapt |
| Increased maintenance surface (agent + skills + instructions) | Medium | Low | Skills are small, focused files; agent profile shrinks as workflow steps move to skills |
| Cross-platform inconsistency (VS Code vs GitHub.com) | Low | Low | Skills supported in both VS Code and GitHub.com; JetBrains in preview |

---

## 6. Summary of Findings

| Question | Answer |
|----------|--------|
| **Should EJS be an agent or a skill?** | **Both.** They serve complementary purposes. |
| **What should stay as an agent?** | The observer persona, tier coordination, subagent delegation, explicit invocation (Tier 2/3) |
| **What should become skills?** | Session initialization, session wrap-up, sub-agent capture — specific multi-step workflows |
| **What stays as custom instructions?** | Always-on silent recording contract (Tier 1) |
| **Is this a breaking change?** | No. Skills are additive and don't require modifying the existing agent or instructions. |
| **When should this be implemented?** | After this research is reviewed and a decision is accepted (ADR recommended) |

---

## Sources

- [GitHub Docs: About Custom Agents](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents)
- [GitHub Docs: About Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [GitHub Docs: Creating Agent Skills](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills)
- [GitHub Docs: Customization Cheat Sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)
- [GitHub Docs: Response Customization](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- [Agent Skills Open Standard](https://agentskills.io) (Anthropic-maintained)
- [EJS Repository Analysis](https://github.com/McFuzzySquirrel/Engineering-Journey-System) — 533 "agent" refs, 21 "skill" refs
