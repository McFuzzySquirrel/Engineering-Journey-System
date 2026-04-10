# EJS Story Builder Skill

## Overview

The **EJS Story Builder** skill synthesizes your entire Engineering Journey System (EJS) — all journey sessions and ADR decisions — into a complete end-to-end project narrative. It shows what you built, how you built it, and weaves together the perspectives of humans, agents, and their collaboration.

**Output**: A polished markdown narrative saved to `ejs-docs/narratives/story-YYYY-MM-DD.md` and displayed in chat.

---

## When to Use This Skill

Invoke this skill when you want to:
- **Tell the complete story** of your project from start to now
- **Build a project narrative** that covers decisions, experiments, and learnings
- **Understand the arc** of your engineering journey chronologically
- **Share your work** with stakeholders in narrative form (not raw session files)
- **Generate project documentation** that captures "what happened and why"

**Trigger phrases** (use `@ejs-story-builder` or reference this in chat):
- "build story"
- "generate story"
- "tell the story"
- "project narrative"
- "end-to-end story"
- "full story"
- "what happened"
- "project history"
- "summarize all sessions"

---

## How to Invoke

### In VS Code Chat

```
@ejs-story-builder Generate a story of our project
```

Or simply ask:
```
Tell me the complete story of this project
```

---

## How It Works

The skill follows a **7-step process** to build the narrative:

### 1. **Identify the Human Perspective** *(new!)*
The skill asks you: *"How would you like the human/lead perspective to be identified?"*

This could be:
- Your personal name: "Alice worked with the Copilot agent..."
- Your GitHub handle: "@alice-dev identified the gap"
- Your team name: "The backend team..."
- A role: "The lead engineer..."
- Generic: "The human..." (can be customized later)

**Default behavior**: If you don't specify, the skill checks your journey files' `author` field and uses that. If no author is found, it defaults to "The lead engineer".

### 2. **Determine Scope** (Optional)
By default, the skill includes **all** sessions and ADRs. You can optionally filter:

- **By date range**: `from: 2026-03-01 to: 2026-04-10`
- **By tags**: e.g., `#performance, #api-design`
- **By session IDs**: specific sessions only
- **By ADR IDs**: anchor around specific decisions

Example:
```
Build story from March onward, focusing on #architecture and #testing
```

### 3. **Gather the Index**
The skill queries your data using either:
- **SQLite database** (`python3 scripts/adr-db.py story`) for a high-level index
- **File scanning** if the database isn't available, reading `ejs-docs/journey/` and `ejs-docs/adr/` directly

### 4. **Read & Extract**
For each session and ADR in scope, the skill extracts:
- **From journeys**: Problem, intent, decisions, learnings, perspectives, experiments, agent collaboration
- **From ADRs**: Context, options considered, decision rationale, consequences, key learnings

### 5. **Build Timeline**
The skill orders sessions chronologically and groups related sessions into narrative arcs:
- Same-day sessions working on related problems → **one arc**
- Multi-day work on the same feature → **one thematic arc**
- Standalone sessions → **their own arc**

### 6. **Generate Narrative**
Writing the story by:
- **Weaving perspectives naturally** into the chronological flow (not separating them)
- **Using decisions as plot points** — decisions drive the narrative forward
- **Showing cause-and-effect** — how one decision led to the next, how experiments shifted thinking
- **Tracking pivots** — when and why you changed direction
- **Tracing everything back** to source sessions/ADRs for verifiability

### 7. **Output & Save**
- Displays the complete narrative in chat
- Saves to `ejs-docs/narratives/story-YYYY-MM-DD.md`
- Provides a summary: session count, ADR count, date range, word count

---

## Output Structure

Generated narratives follow this structure:

```markdown
# [Project Name] — Engineering Journey

## Prologue
The problem statement, vision, and context that started the work.
(If personalized, includes a note about how to adapt for your own projects.)

## The Journey
Organized into **phases/arcs**, each covering:
- What was happening (intent)
- How it unfolded (interactions, experiments, pivots, perspectives woven in)
- What was decided (decisions + rationale, linked to ADRs)
- What was learned (key insights)

[Additional phases as needed]

## Epilogue
Current status, overall learnings, future direction.

## Appendix
Reference tables for sessions and ADRs mentioned in the story.

## Template Guide (if personalized)
Instructions for adapting this narrative template for other projects.
```

---

## Examples

### Example 1: Generate Full Story
```
@ejs-story-builder Generate a complete story of this project
```
✅ Includes all sessions and ADRs from start to now.  
✅ Asks how you'd like to be identified in the narrative.  
✅ Saves to `ejs-docs/narratives/story-2026-04-10.md`.

### Example 2: Generate Story with Date Filter
```
Build a story starting from March 15, 2026
```
✅ Includes only sessions/ADRs from March 15 onward.  
✅ Useful for quarterly reviews or phase-based narratives.

### Example 3: Generate Story by Theme
```
Tell the story focusing on #architecture decisions
```
✅ Includes sessions tagged with architecture work.  
✅ Provides a focused narrative around a specific theme.

### Example 4: Generate with Custom Identification
```
Build the story. I want to be called "the platform team" in the narrative.
```
✅ Replaces all instances of "the human" with "the platform team".  
✅ Enables group-led or team-focused narratives.

---

## What You'll Learn

The generated story surfaces:

### **What Was Built**
The features, decisions, and architecture that emerged from your engineering journey.

### **How It Was Built**
The experiments you ran, pivots you made, and collaboration patterns that worked (or didn't).

### **Why It Was Built That Way**
The reasoning behind major decisions, trade-offs considered, and constraints that shaped the work.

### **Perspectives on Collaboration**
- **Human perspective**: Your priorities, overrides, and direction-setting
- **Agent perspective**: Where Copilot or other agents contributed independently
- **Human+Agent**: The back-and-forth that shaped ideas
- **Agent-to-Agent**: How multiple agents coordinated (if applicable)

---

## Detailed Instructions

For a complete step-by-step breakdown of how the skill works internally, see [SKILL.md](./SKILL.md).

That file includes:
- Extraction tables for journey and ADR files
- Narrative tone and voice guidelines
- Grouping rules for sessions
- Perspective identification patterns
- Output confirmation checklist

---

## Output Files

After running the skill, you'll have:

```
ejs-docs/
└── narratives/
    └── story-2026-04-10.md          ← Generated narrative (new file)
```

The narrative is:
- ✅ Chronological and story-driven
- ✅ Fully sourced to journey/ADR files
- ✅ Ready to share or publish
- ✅ Personalized with your identification method
- ✅ Includes a template guide for adaptation

---

## Tips & Best Practices

### 🎯 Before Running the Skill
- Ensure your journey files are complete with:
  - YAML frontmatter (`date`, `session_id`, `tags`, `adr_links`)
  - Clear "Problem / Intent" sections
  - Populated "Decisions Made" and "Key Learnings" sections
- Ensure your ADRs are up-to-date with:
  - Clear context and decision statements
  - Rationale explaining the "why"
  - Links back to originating sessions

### 🎯 Picking an Identification Method
| Method | Best For |
|--------|----------|
| Personal name | Solo projects, personal branding, clear attribution |
| GitHub handle | Open-source projects, community narratives |
| Team name | Group-led projects, organizational context |
| Role | Emphasizing functionality over identity ("the architect decided...") |
| Generic + Node | Reusable template for others to customize |

### 🎯 Using Filters Effectively
- **Date ranges**: Good for milestone reviews ("Q1 2026: The Foundation Phase")
- **Tags**: Good for feature-specific narratives ("The API redesign story")
- **Session IDs**: Good for deep dives on specific decisions
- **ADR IDs**: Good for decision-focused narratives

### 🎯 After Generation
- Review the narrative for factual accuracy
- Check that transitions between arcs make sense
- Verify that key decisions are properly explained
- Consider sharing the "Template Guide" section with others who might want to adapt the skill

---

## Troubleshooting

### Issue: "No sessions found"
**Check:**
- Are your journey files in `ejs-docs/journey/YYYY/`?
- Are they named `ejs-session-*.md`?
- Do they have proper YAML frontmatter with a `date` field?

### Issue: "ADRs not linked"
**Check:**
- Do your ADR files have `session_id` in their frontmatter?
- Do your journey files have `adr_links` in their frontmatter?
- Are ADR file names formatted as `####-description.md` (e.g., `0013-sqlite-backed-adr-index.md`)?

### Issue: "Story file not saved"
**Check:**
- Does `ejs-docs/narratives/` directory exist? (The skill will create it if needed.)
- Do you have write permissions in `ejs-docs/`?
- Check the chat for error messages or confirmation of where the file was saved.

---

## Integration with EJS

This skill is part of the [Engineering Journey System (EJS)](https://github.com/ejs-journey/ejs-docs) — a system for recording and synthesizing engineering collaboration.

**Related files:**
- Journey template: `ejs-docs/journey/_templates/journey-template.md`
- ADR template: `ejs-docs/adr/0000-adr-template.md`
- Database tool: `scripts/adr-db.py`
- Session lifecycle guide: `ejs-docs/session-lifecycle-patterns.md`

**Related skills:**
- (More skills TBD as EJS grows)

---

## Questions?

For more details on the underlying procedure, see [SKILL.md](./SKILL.md).

For questions about EJS implementation, visit the main [Engineering Journey System docs](../../ejs-docs/).
