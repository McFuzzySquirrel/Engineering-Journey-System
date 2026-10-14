---
id: ADR-0016
type: adr
title: Copilot Hooks as Layer 0 Structural Automation
status: deprecated
applies_to: ["legacy/**"]
tags: [historical, ejs, hooks, automation]
supersedes: []
relates_to: []
derived_from: []
date: 2026-03-30
deciders: [Engineering Journey System maintainers]
---

# ADR-0016: Copilot Hooks as Layer 0 Structural Automation

## Agent Rules

- **MUST NOT:** Install or execute the archived EJS hooks as part of decision-graph workflows.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('legacy/ejs-docs/adr/0016-copilot-hooks-layer-0-structural-automation.md')) process.exit(1)"`
- **Expected:** The original EJS decision remains available in the inactive archive.

## Context and Problem Statement

EJS depended on agents to create and maintain session records. The project
considered platform hooks for reliable structural automation while retaining
agent reasoning for semantic content.

## Decision Drivers

- Guarantee structural session setup and validation.
- Capture sub-agent events consistently.
- Avoid trying to automate semantic reasoning with shell scripts.

## Considered Options

- Add only a session-start hook.
- Add lifecycle bookends and sub-agent capture.
- Add tool enforcement and per-tool auditing as well.

## Decision Outcome

The historical EJS decision chose lifecycle bookends and sub-agent capture
hooks, with instructions and skills responsible for semantic recording.
ADR-0001 retires the EJS lifecycle architecture. The hooks are historical
files only and must not be run.

## Consequences

Hooks made structural behavior deterministic but added platform coupling and
maintenance surface. The inactive archive preserves the implementation for
historical reference.
