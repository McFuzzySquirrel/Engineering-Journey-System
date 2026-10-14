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
date: 2026-10-14
deciders: [Engineering Journey System maintainers]
---

# ADR-0015: Micro-Instruction Simplification of EJS Always-On Recording Contract

- **Deciders:** Engineering Journey System maintainers
- **Date:** 2026-10-14 (original decision: 2026-03-13)

**Technical Story:** Historical EJS instruction simplification decision,
migrated during decision-graph Phase 9. See the
[original ADR](../../../legacy/ejs-docs/adr/0015-micro-instruction-simplification.md).

## Agent Rules

- **MUST NOT:** Treat the EJS micro-instruction as decision-graph's active instruction contract.

## Verify

- **Check:** `node -e "const fs=require('node:fs'); const p=fs.readFileSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md','utf8'); if (!p.includes('ADR-0015') || !fs.existsSync('legacy/ejs-docs/adr/0015-micro-instruction-simplification.md')) process.exit(1)"`
- **Expected:** ADR-0001 supersedes this EJS contract, and its source remains archived.

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

## Positive Consequences

The micro-instruction reduced always-on context and separated behavior from
template structure.

## Negative Consequences

Detailed checkpoint guidance moved into on-demand materials, and a separate
delegation fragment needed to be maintained. ADR-0001 replaces the EJS
recording contract.

## Pros and Cons of the Options

### Micro-instruction model

- Good, because it reduced always-on context and left structural detail in
  templates and skills.
- Bad, because detailed guidance was no longer always visible.

### Consolidated instructions

- Good, because it kept the workflow in a single instruction file.
- Bad, because it increased always-on context and duplicated skill content.

### Hybrid micro-instruction and delegation fragment

- Good, because it combined a short contract with delegated-agent coverage.
- Bad, because the fragment introduced another convention to maintain.

## Links

- Superseded by [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md).
- [Original EJS ADR](../../../legacy/ejs-docs/adr/0015-micro-instruction-simplification.md)
