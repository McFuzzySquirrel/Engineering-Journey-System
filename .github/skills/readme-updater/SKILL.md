---
name: readme-updater
description: >
  Refresh the repository README when project scope, setup, architecture, or
  contributor guidance changes. Keeps the README in sync with living docs.
---

# README Updater

Use this skill when:
- The project's purpose or scope changed this session
- Setup or installation instructions are outdated
- A new architectural component, service, or major dependency was introduced
- The contributor guide needs updating (new workflows, tools, conventions)
- The session wrap-up step 9 flags README-relevant changes
- The pre-commit hook warns that the README is stale

> **Note:** The README is a *living document*. Update only the sections
> affected by this session. Do not rewrite sections that remain accurate.

## Steps

1. **Read the current README**
   - Open `README.md` at the repository root
   - Note which sections are present and their current content

2. **Read the README template (if starting fresh)**
   - If `README.md` is missing or minimal, use the template at
     `ejs-docs/architecture/_templates/readme-template.md` as a starting point

3. **Review this session's changes**
   - Read the current session journey file
   - Identify any changes to: project purpose, setup steps, architecture, dependencies, or workflows

4. **Update affected sections only**
   - Revise sections that are outdated or incomplete
   - Preserve sections that remain accurate
   - For each updated section, ensure the content reflects the current state

5. **Update the "Recent Updates" section**
   - Append or update the most recent entry:
     ```
     - **YYYY-MM-DD** — <one-line summary of what changed> (session: `<session-id>`)
     ```

6. **Sync the knowledge graph**
   - After saving the README, run:
     ```
     python scripts/knowledge-graph.py sync
     ```

7. **Confirm update**
   - Inform the user: `"README updated: README.md"`

## README Sections

| Section | What to capture |
|---|---|
| **Project Title + Badge** | Name, status badge, one-line description |
| **Overview** | What the project does and why it exists |
| **Quick Start** | Minimal steps to get running (install, configure, run) |
| **Architecture** | Brief summary + link to `ejs-docs/architecture/architecture-blueprint.md` |
| **Recent Decisions** | Link to latest ADRs (auto-populated from `ejs-docs/adr/`) |
| **Contributing** | How to contribute, branching strategy, PR process |
| **Recent Updates** | Chronological log of significant README changes |

## Key Principle

The README is the *front door* to the repository. It should answer three
questions immediately: What is this? How do I run it? Where do I learn more?
Everything else belongs in linked documents (blueprint, ADRs, journeys).

## Contextual References

- README template: `ejs-docs/architecture/_templates/readme-template.md`
- Architecture Blueprint: `ejs-docs/architecture/architecture-blueprint.md`
- ADR index: `ejs-docs/adr/`
- Knowledge graph tool: `scripts/knowledge-graph.py`
- Architecture blueprint skill: `.github/skills/arch-blueprint/SKILL.md`
- Session wrap-up skill: `.github/skills/ejs-session-wrapup/SKILL.md`
