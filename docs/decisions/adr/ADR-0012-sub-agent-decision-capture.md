---
id: ADR-0012
type: adr
title: Sub-Agent Decision Capture and Handoff Protocol
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, agents]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0012: Sub-Agent Decision Capture and Handoff Protocol

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-02-10)

**Technical Story:** Historical EJS multi-agent workflow decision, migrated
during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0012-sub-agent-decision-capture-protocol.md).

## Agent Rules

- **MUST NOT:** Treat this sub-agent capture protocol as an active decision-graph requirement.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0012') || !fs.existsSync('legacy/ejs-docs/adr/0012-sub-agent-decision-capture-protocol.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this record, and its EJS source remains archived.

## Context and Problem Statement

EJS captured outcomes from delegated work but often lost the approaches,
alternatives, trade-offs, and handoffs that led to them.

## Decision Drivers

- Preserve the reasoning behind sub-agent contributions.
- Trace handoffs when one agent's output informs another's work.
- Keep chronological delegation events distinct from structured decisions.

## Considered Options

- Let the main agent consolidate outcomes in existing journey sections.
- Add a structured contribution section and handoff protocol.

## Decision Outcome

The historical EJS decision added a Sub-Agent Contributions section with
decisions, alternatives, outcomes, handoffs, and a machine-readable extract.
ADR-0001 supersedes the journey-recording process; this protocol is retained
only as historical rationale.

## Positive Consequences

The structured section distinguished delegation events from sub-agent
decisions and made handoffs traceable.

## Negative Consequences

The protocol lengthened journey templates and depended on the coordinating
agent to capture contributions. ADR-0001 retires the session-recording
workflow.

## Pros and Cons of the Options

### Main-agent consolidation

- Good, because it kept the existing journey structure simple.
- Bad, because sub-agent reasoning and handoff chains were easily lost.

### Structured contributions and handoff protocol

- Good, because it captured decisions, alternatives, outcomes, and handoffs.
- Bad, because it added template complexity and coordination work.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0012-sub-agent-decision-capture-protocol.md)
