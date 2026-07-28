---
name: arch-blueprint
description: >
  Generate or update the Architecture Blueprint document based on decisions and
  changes from the current session. Covers system context, component map, data
  flows, tech decisions, and constraints.
---

# Architecture Blueprint Generator

Use this skill when:
- A new system, service, or major component was introduced this session
- A tech stack decision was made (framework, datastore, protocol, infrastructure)
- Data flows or system boundaries changed
- The current `ejs-docs/architecture/architecture-blueprint.md` is missing or stale
- The session wrap-up step 8 flags architectural decisions

> **Note:** This skill produces a living document. Every invocation *updates*
> the existing blueprint rather than replacing it. Preserve sections that are
> still accurate; only revise what changed this session.

## Steps

1. **Read the current blueprint (if it exists)**
   - Check `ejs-docs/architecture/architecture-blueprint.md`
   - Note which sections are present and which are outdated or absent

2. **Review this session's decisions**
   - Read the current session journey file
   - Identify any architectural decisions, new components, or changed data flows
   - Cross-reference with relevant ADRs linked in the journey

3. **Update or create the blueprint**
   - Use the template at `ejs-docs/architecture/_templates/arch-blueprint-template.md`
   - Only update sections affected by this session's changes
   - Preserve existing content that remains accurate
   - For each changed section, add a `<!-- Updated: YYYY-MM-DD session: <id> -->` comment

4. **Link back to session and ADRs**
   - In the blueprint's `## Recent Changes` section, append an entry:
     ```
     - YYYY-MM-DD (`<session-id>`): <one-line description of change> [ADR-NNNN if applicable]
     ```

5. **Sync the knowledge graph**
   - After saving the blueprint, run:
     ```
     python scripts/knowledge-graph.py sync
     ```

6. **Confirm update**
   - Inform the user: `"Architecture Blueprint updated: ejs-docs/architecture/architecture-blueprint.md"`

## Sections in the Blueprint

| Section | What to capture |
|---|---|
| **System Context** | Who uses the system, external integrations, boundaries |
| **Component Map** | Named components/services and their responsibilities |
| **Data Flows** | How data moves between components (sequence or description) |
| **Tech Decisions** | Key technology choices with rationale (link to ADRs) |
| **Constraints** | Non-functional requirements: performance, security, scale |
| **Open Questions** | Unresolved architectural questions for future sessions |
| **Recent Changes** | Chronological log of blueprint updates |

## Key Principle

The blueprint is a *current-state snapshot*, not a historical log. History
lives in ADRs and session journeys. The blueprint should always reflect what
the system looks like *today*.

## Contextual References

- Blueprint template: `ejs-docs/architecture/_templates/arch-blueprint-template.md`
- Living blueprint: `ejs-docs/architecture/architecture-blueprint.md`
- ADR template: `ejs-docs/adr/0000-adr-template.md`
- Knowledge graph: `ejs-docs/knowledge-graph/index.json`
- Knowledge graph tool: `scripts/knowledge-graph.py`
- Session wrap-up skill: `.github/skills/ejs-session-wrapup/SKILL.md`
