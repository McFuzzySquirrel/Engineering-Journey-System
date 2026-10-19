---
id: SDR-20261014-009
type: sdr
title: Configure GitHub issue tracking and agent docs
status: open
applies_to:
  - AGENTS.md
  - docs/agents/domain.md
  - docs/agents/issue-tracker.md
  - docs/agents/triage-labels.md
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
---

# SDR-20261014-009: Configure GitHub issue tracking and agent docs

## Decision

Use this repository’s GitHub Issues for work and Wayfinder maps, the five canonical triage labels, and a single-context domain-documentation layout.

## Why

The repository remote is on GitHub, the repository is single-context, and the standard label vocabulary maps directly to the installed triage skill.

## Alternatives considered

- Track work in local Markdown or GitLab Issues.
- Use a multi-context domain-documentation map.
