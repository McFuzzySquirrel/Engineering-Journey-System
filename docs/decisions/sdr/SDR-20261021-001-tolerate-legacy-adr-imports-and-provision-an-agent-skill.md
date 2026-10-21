---
id: SDR-20261021-001
type: sdr
title: Tolerate legacy ADR imports and provision an agent skill
status: open
applies_to:
  - src/core/parse/**
  - src/cli/**
  - test/**
tags: []
date: '2026-10-21'
promoted_to: null
agent: OpenCode
session: legacy-adr-import-skill
---

# SDR-20261021-001: Tolerate legacy ADR imports and provision an agent skill

## Decision

Accept short-numbered filenames and spaced ADR headings, read inline status/date/tags, continue sync on unparseable files, resume init, and provision .agents/skills/decision-graph.

## Why

Real repositories use ADR-001 and inline metadata; one bad file must not leave init half-complete, and agents need a migration and lint-triage playbook.

## Alternatives considered

None.
