---
id: ADR-0016
type: adr
title: Copilot Hooks as Layer 0 Structural Automation
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, hooks, automation]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0016: Copilot Hooks as Layer 0 Structural Automation

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-03-30)

**Technical Story:** Historical EJS lifecycle automation decision, migrated
during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0016-copilot-hooks-layer-0-structural-automation.md).

## Agent Rules

- **MUST NOT:** Install or execute archived EJS hooks as part of decision-graph workflows.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0016') || !fs.existsSync('legacy/ejs-docs/adr/0016-copilot-hooks-layer-0-structural-automation.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this EJS hook workflow, and its source remains archived.

## Context and Problem Statement

EJS depended on agents to create and maintain session records. The project
considered platform hooks for reliable structural automation while retaining
agent reasoning for semantic content.

## Decision Drivers

- Guarantee structural session setup and validation.
- Capture sub-agent events consistently.
- Avoid trying to automate semantic reasoning with shell scripts.

## Considered Options

- Add only a session-start hook.
- Add lifecycle bookends and sub-agent capture.
- Add tool enforcement and per-tool auditing as well.

## Decision Outcome

The historical EJS decision chose lifecycle bookends and sub-agent capture
hooks, with instructions and skills responsible for semantic recording.
ADR-0001 retires the EJS lifecycle architecture. The hooks are historical
files only and must not be run.

## Positive Consequences

Hooks made EJS session scaffolding and validation deterministic.

## Negative Consequences

They introduced platform coupling, maintenance work, and evolving hook-schema
risk. ADR-0001 retires the EJS hook workflow; the source remains inactive.

## Pros and Cons of the Options

### Session-start only

- Good, because it delivered a scaffold with minimal implementation effort.
- Bad, because it did not validate sessions or capture sub-agent events.

### Lifecycle bookends and sub-agent capture

- Good, because it covered setup, completion, and delegation structure.
- Bad, because it added scripts and depended on Copilot-specific hooks.

### Lifecycle, enforcement, and auditing

- Good, because it offered the broadest automation and audit trail.
- Bad, because per-tool hooks increased complexity and could affect
  performance or block agent work.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0016-copilot-hooks-layer-0-structural-automation.md)
