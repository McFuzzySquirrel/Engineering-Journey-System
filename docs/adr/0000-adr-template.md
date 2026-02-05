---
ejs:
  type: journey-adr
  version: 1.0
  adr_id: XXXX
  title: <Short, descriptive title>
  date: YYYY-MM-DD
  status: proposed | accepted | deprecated
  session_id: ejs-session-<date>-<seq>

actors:
  humans:
    - id: <name>
      role: <role>
  agents:
    - id: <agent-name>
      role: <agent-role>

context:
  repo: <repo-name>
  branch: <branch>
  platform: <github | ado | local>
  tools:
    - <tool>
---

# Context

Describe the problem or opportunity that triggered this session.  
Include constraints, assumptions, and environmental context.

---

# Session Intent

What the human intended to achieve at the start of the session.

---

# Collaboration Summary

Describe how the human and agent collaborated.  
Include notable pivots, corrections, and insights.

---

# Considered Options

## Option A
Description

## Option B
Description

---

# Decision

Clearly state the decision made.

---

# Rationale

Explain *why* this option was chosen.  
Include trade-offs and rejected alternatives.

---

# Consequences

### Positive
- …

### Negative / Trade-offs
- …

---

# Key Learnings

What the human(s) learned during this journey.  
Focus on transferable knowledge.

---

# Agent Guidance

Instructions and signals for future agents:
- preferred patterns
- anti-patterns
- useful prompt strategies
- architectural intent

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns: []
  prompts: []
  anti_patterns: []
  future_considerations: []
