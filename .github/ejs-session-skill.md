# Engineering Journey System — Session ADR Skill

## Purpose
Automate end-of-session ADR creation, collaboration summary, and learning capture for developer + agent sessions.  
This skill integrates with GitHub Copilot or compatible AI coding agents.

---

## Triggers

Activate when the user signals session end with any of these phrases:

- "Generate ADR for this session"
- "Wrap up this session"
- "End session"
- "Prepare journey artifacts"

---

## Actions on Trigger

### 1. Switch Modes
- Stop suggesting new code or expanding scope
- Switch to **Journey Capture Mode**

### 2. Capture Collaboration Summary
- Extract human + agent interactions from session
- Record key decisions, pivots, and corrections
- Write to:  
  `docs/journey/summaries/<session-id>-summary.md`

### 3. Capture Key Learnings
- Extract lessons learned for future sessions
- Write to:  
  `docs/journey/learning/<session-id>-learning.md`

### 4. Draft Journey ADR
- Use `docs/adr/adr-template.md` as base
- Fill in:
  - Context
  - Session Intent
  - Collaboration Summary (link to summary file)
  - Options Considered
  - Decision
  - Rationale
  - Consequences
  - Key Learnings (link to learning file)
  - Agent Guidance
- Write to:  
  `docs/adr/<session-id>-<short-title>.md`

### 5. Generate Session ID
- Format: `ejs-session-YYYY-MM-DD-<seq>`
- Ensure uniqueness per day

---

## Notes for Agents

- Treat session content as frozen once end-session is triggered  
- Ensure **all decisions and learning points are explicit**  
- Do not overwrite previous ADRs or summaries with the same session ID  
- Links in ADR to summary/learning files should be relative
