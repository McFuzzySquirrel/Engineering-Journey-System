---
id: ADR-0010
type: adr
title: Adopt Engineering Journey System for Agent-Assisted Development
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, session-recording]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0010: Adopt Engineering Journey System for Agent-Assisted Development

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-02-05)

**Technical Story:** Historical EJS adoption decision, migrated during
decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0010-engineering-journey-system-adoption.md).

## Agent Rules

- **MUST NOT:** Treat this deprecated EJS workflow as current decision-graph policy.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0010') || !fs.existsSync('legacy/ejs-docs/adr/0010-engineering-journey-system-adoption.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this record, and its EJS source remains archived.

## Context and Problem Statement

Traditional ADRs captured decisions but not the collaboration and learning
that informed them. The project sought a structured, portable way to preserve
human-agent collaboration and useful session learning.

## Decision Drivers

- Capture reusable learning and agent-readable guidance.
- Preserve structure without relying on unstructured session notes.
- Keep the workflow lightweight enough to adopt consistently.

## Considered Options

- Continue with traditional ADRs only.
- Capture free-form session notes.
- Adopt EJS with structured session journeys and numbered ADRs.

## Decision Outcome

The historical decision adopted EJS, using session journeys for collaboration
history, numbered ADRs for significant decisions, and agent instructions for
recording guidance. The decision-graph pivot in ADR-0001 supersedes this
workflow; the old source remains under `legacy/`.

## Positive Consequences

EJS made collaboration history and reusable learning explicit.

## Negative Consequences

The workflow increased documentation effort and required consistent
session-lifecycle maintenance. ADR-0001 replaces it with durable decisions
rather than continuous session recording.

## Pros and Cons of the Options

### Traditional ADRs only

- Good, because the existing decision format was familiar and lightweight.
- Bad, because it did not preserve agent collaboration or session learning.

### Free-form session notes

- Good, because contributors could capture context without a schema.
- Bad, because the notes would be difficult to query and reuse consistently.

### Adopt EJS

- Good, because structured journeys and numbered ADRs preserved collaboration
  and reusable guidance.
- Bad, because the recording workflow added maintenance and context cost.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0010-engineering-journey-system-adoption.md)
