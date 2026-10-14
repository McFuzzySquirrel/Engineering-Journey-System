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
date: 2026-02-05
deciders: [Engineering Journey System maintainers]
---

# ADR-0010: Adopt Engineering Journey System for Agent-Assisted Development

## Agent Rules

- **SHOULD:** Treat this record as historical rationale for EJS, not as current decision-graph policy.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0010-engineering-journey-system-adoption.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

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

## Consequences

EJS provided collaboration traceability and reusable learning, at the cost of
additional documentation and lifecycle maintenance. Those costs informed the
later choice to store durable decisions rather than continuously record
sessions.
