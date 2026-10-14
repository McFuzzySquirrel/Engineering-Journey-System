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
date: 2026-03-11
deciders: [Engineering Journey System maintainers]
---

# ADR-0014: Agent Skills for Session Lifecycle Workflows

## Agent Rules

- **SHOULD:** Treat EJS lifecycle skills as archived artifacts; do not activate them in decision-graph work.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0014-agent-skills-for-session-lifecycle.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

On-demand skills reduced always-on context but added files to maintain and
depended on platform relevance detection. Their content is preserved in the
inactive archive.
