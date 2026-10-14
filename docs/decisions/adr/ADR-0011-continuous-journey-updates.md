---
id: ADR-0011
type: adr
title: Shift EJS to Start-of-Session with Continuous Journey Updates
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, session-recording]
supersedes: []
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0011: Shift EJS to Start-of-Session with Continuous Journey Updates

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-02-07)

**Technical Story:** Historical EJS lifecycle decision, migrated during
decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0011-start-of-session-continuous-journey-updates.md).

## Agent Rules

- **MUST NOT:** Treat continuous journey updates as an active decision-graph requirement.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0011') || !fs.existsSync('legacy/ejs-docs/adr/0011-start-of-session-continuous-journey-updates.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this record, and its EJS source remains archived.

## Context and Problem Statement

End-of-session reconstruction depended on memory and lost details in
multi-step work. The project considered moving journey creation to session
start and maintaining the artifact as work progressed.

## Decision Drivers

- Capture context while it is fresh.
- Distribute documentation effort instead of concentrating it at session end.
- Improve the accuracy of multi-step collaboration histories.

## Considered Options

- Keep end-of-session reconstruction.
- Make continuous updates optional.
- Require session initialization, continuous updates, and finalization.

## Decision Outcome

The historical EJS decision chose a three-phase session lifecycle:
initialize the journey at the start, update it during work, and finalize it at
the end. ADR-0001 supersedes this recording workflow in favor of durable ADRs
and optional SDR capture.

## Positive Consequences

Creating journeys at session start reduced reliance on memory and spread
recording effort throughout the work.

## Negative Consequences

The process required frequent updates and agent discipline. ADR-0001 replaces
this session-recording workflow; journey artifacts remain archived under
`legacy/`.

## Pros and Cons of the Options

### End-of-session reconstruction

- Good, because it required no lifecycle change.
- Bad, because it concentrated effort at the end and depended on memory.

### Optional continuous updates

- Good, because contributors could choose when to document.
- Bad, because optional use led to inconsistent coverage.

### Start-of-session continuous updates

- Good, because context and outcomes were captured while fresh.
- Bad, because agents had to maintain the journey throughout the session.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0011-start-of-session-continuous-journey-updates.md)
