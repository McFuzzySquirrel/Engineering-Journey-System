---
id: SDR-20261021-004
type: sdr
title: Do not limit decision record length
status: open
applies_to:
  - src/core/project-lint.ts
  - src/server/http.ts
  - test/cli.test.ts
  - docs/IMPLEMENTATION-PLAN.md
tags: []
date: '2026-10-21'
promoted_to: null
agent: OpenCode
session: remove-record-line-budget
---

# SDR-20261021-004: Do not limit decision record length

## Decision

Remove the 200-line line-budget warning from local, MCP, and remote lint; keep tokenBudget for compiled AGENTS.md guidance.

## Why

ADRs are authoritative records and may need detailed context; a line warning discourages necessary detail without protecting correctness.

## Alternatives considered

None.
