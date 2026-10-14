---
id: SDR-20261014-005
type: sdr
title: Capture and promote session decisions
status: open
applies_to:
  - src/core/sdr.ts
  - src/cli/commands.ts
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 5
---

# SDR-20261014-005: Capture and promote session decisions

## Decision

Capture short-lived decisions as SDRs and promote durable decisions into proposed ADRs with graph links.

## Why

Separating session notes from accepted architecture decisions avoids premature ADRs while preserving a path to durable policy.

## Alternatives considered

- Create ADRs for every session decision
- Keep session decisions only in chat
