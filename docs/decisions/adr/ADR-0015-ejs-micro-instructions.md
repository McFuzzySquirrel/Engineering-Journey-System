---
id: ADR-0015
type: adr
title: Micro-Instruction Simplification of EJS Always-On Recording Contract
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, instructions]
supersedes: []
relates_to: []
derived_from: []
date: 2026-03-13
deciders: [Engineering Journey System maintainers]
---

# ADR-0015: Micro-Instruction Simplification of EJS Always-On Recording Contract

## Agent Rules

- **SHOULD:** Treat the EJS micro-instruction pattern as historical context, not as the active instruction contract for this repository.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0015-micro-instruction-simplification.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

## Context and Problem Statement

The EJS always-on contract repeated details already present in templates and
skills, increasing context cost and leaving delegated agents without direct
recording instructions.

## Decision Drivers

- Reduce redundant always-on instructions.
- Separate behavioral requirements from structural templates and procedures.
- Provide a compact convention for delegated work.

## Considered Options

- Replace the long contract with a micro-instruction.
- Consolidate skills into always-on instructions.
- Combine a micro-instruction with a delegation fragment.

## Decision Outcome

The historical EJS decision adopted a short always-on contract and a
sub-agent instruction fragment, leaving structural detail in templates and
skills. ADR-0001 supersedes the EJS recording contract.

## Consequences

The shorter instruction reduced context and duplication, but moved detailed
checkpoint guidance into on-demand materials. The source remains in
`legacy/`.
