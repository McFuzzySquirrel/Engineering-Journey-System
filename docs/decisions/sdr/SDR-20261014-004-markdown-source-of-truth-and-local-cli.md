---
id: SDR-20261014-004
type: sdr
title: Markdown source of truth and local CLI
status: open
applies_to:
  - src/cli/**
  - docs/decisions/**
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 4
---

# SDR-20261014-004: Markdown source of truth and local CLI

## Decision

Keep Markdown records canonical and use the CLI to initialize, import, sync, create, and query them through the local index.

## Why

Versioned source records remain reviewable in Git and the database can be reconstructed after loss.

## Alternatives considered

- Database as source of truth
- Direct file scans for every query
