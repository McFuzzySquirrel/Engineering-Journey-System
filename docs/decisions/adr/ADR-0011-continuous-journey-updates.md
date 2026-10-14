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
date: 2026-02-07
deciders: [Engineering Journey System maintainers]
---

# ADR-0011: Shift EJS to Start-of-Session with Continuous Journey Updates

## Agent Rules

- **SHOULD:** Treat continuous journey updates as a historical EJS practice, not a decision-graph requirement.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0011-start-of-session-continuous-journey-updates.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

The lifecycle improved freshness and reduced end-of-session reconstruction,
but required frequent updates and agent discipline. Journey artifacts and
their lifecycle instructions remain archived under `legacy/`.
