---
id: ADR-0014
type: adr
title: Agent Skills for Session Lifecycle Workflows
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, agent-skills]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0014: Agent Skills for Session Lifecycle Workflows

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-03-11)

**Technical Story:** Historical EJS instruction architecture decision,
migrated during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0014-agent-skills-for-session-lifecycle.md).

## Agent Rules

- **MUST NOT:** Activate the archived EJS lifecycle skills in decision-graph work.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0014') || !fs.existsSync('legacy/ejs-docs/adr/0014-agent-skills-for-session-lifecycle.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes the EJS skill workflow, and its source remains archived.

## Context and Problem Statement

EJS used custom instructions and an agent profile, while its lifecycle
procedures could be loaded on demand to avoid keeping detailed workflows in
always-on context.

## Decision Drivers

- Separate agent persona and coordination from task-specific procedures.
- Keep always-on context concise.
- Reuse a cross-platform skill format.

## Considered Options

- Keep all lifecycle instructions in the agent profile.
- Replace the agent profile with skills.
- Use both the profile and skills for separate purposes.

## Decision Outcome

The historical EJS decision kept the agent profile and added skills for
initialization, wrap-up, and sub-agent capture. ADR-0001 retires those
session-recording workflows; the archived skills must not be run.

## Positive Consequences

On-demand skills reduced always-on context by separating lifecycle procedures
from the EJS agent profile.

## Negative Consequences

The approach added files to maintain and depended on platform relevance
detection. ADR-0001 retires the EJS lifecycle process.

## Pros and Cons of the Options

### Agent profile only

- Good, because it kept persona and lifecycle instructions in one place.
- Bad, because detailed procedures occupied context even when irrelevant.

### Skills only

- Good, because detailed workflows could load on demand.
- Bad, because skills alone did not provide the EJS agent persona and
  coordination behavior.

### Agent profile and skills

- Good, because the profile supplied coordination while skills supplied
  task-specific procedures.
- Bad, because both mechanisms required maintenance and platform support.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0014-agent-skills-for-session-lifecycle.md)
