---
ejs:
  type: journey-adr
  version: 1.0
  adr_id: 0010
  title: Adopt Engineering Journey System for Agent-Assisted Development
  date: 2026-02-05
  status: accepted
  session_id: ejs-session-2026-02-05-01

actors:
  humans:
    - id: doug
      role: lead-engineer
  agents:
    - id: github-copilot
      role: coding-agent

context:
  repo: photo-jumper
  branch: learning/journey
  platform: github
  tools:
    - github-copilot
    - vscode
---

# Context

The project increasingly relies on AI-assisted development across multiple platforms.  
Traditional ADRs captured *what* decisions were made, but not *how* collaboration with agents shaped those decisions or what was learned during the process.

---

# Session Intent

Determine if an enhanced ADR approach could:
- support developer learning
- provide agent-readable memory
- remain lightweight enough to adopt consistently

---

# Collaboration Summary

Human proposed extending ADRs to include agent collaboration and learning.  
Agent suggested schema-based system and `agent.md` as control point.  
Human simplified schema for portability while retaining extensibility.

---

# Considered Options

## Option A – Traditional ADRs Only
Continue using standard ADRs without collaboration or learning capture.

## Option B – Free-Form Session Notes
Capture collaboration in unstructured markdown notes.

## Option C – Engineering Journey System (Chosen)
Adopt structured, schema-driven extension to ADRs with agent instructions.

---

# Decision

Adopt **Engineering Journey System (EJS)** using:
- schema-driven Journey ADRs
- `agent.md` for agent behavior
- lightweight markdown artifacts

---

# Rationale

Option A failed to capture learning and agent contribution.  
Option B lacked structure and was not agent-readable.  
Option C balanced structure, learning value, automation, and cross-platform portability.

---

# Consequences

### Positive
- Clear collaboration traceability
- Reusable learning artifacts
- Improved agent continuity across sessions

### Negative / Trade-offs
- Slight increase in documentation effort
- Requires discipline to maintain

---

# Key Learnings

- Agents need explicit instructions to capture journeys consistently
- Learning capture is more valuable when separated from raw chat logs
- Portability matters more than tooling sophistication

---

# Agent Guidance

- Always distinguish human decisions from agent suggestions
- Capture rejected options explicitly
- Treat learning capture as mandatory
- Optimize for future agent reuse

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - journey-adr
    - dual-mode-agent
  prompts:
    - "Switch to Journey Capture Mode at session end"
  anti_patterns:
    - unstructured-session-notes
  future_considerations:
    - automated ADR validation
