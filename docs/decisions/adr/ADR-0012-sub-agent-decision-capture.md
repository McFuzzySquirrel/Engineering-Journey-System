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
date: 2026-02-10
deciders: [Engineering Journey System maintainers]
---

# ADR-0012: Sub-Agent Decision Capture and Handoff Protocol

## Agent Rules

- **SHOULD:** Treat this sub-agent capture protocol as historical EJS guidance, not as an active repository requirement.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0012-sub-agent-decision-capture-protocol.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

Structured capture improved traceability but increased template complexity
and depended on the coordinating agent to record contributions. The original
protocol remains archived under `legacy/`.
