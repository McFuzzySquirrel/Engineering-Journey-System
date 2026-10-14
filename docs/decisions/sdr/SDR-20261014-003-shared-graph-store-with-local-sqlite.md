---
id: SDR-20261014-003
type: sdr
title: Shared graph store with local SQLite
status: open
applies_to:
  - src/store/**
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 3
---

# SDR-20261014-003: Shared graph store with local SQLite

## Decision

Define a Promise-based Store contract and implement the local index with SQLite, FTS5, and project-scoped graph operations.

## Why

A shared asynchronous contract keeps CLI callers backend-independent while SQLite provides a rebuildable local index.

## Alternatives considered

- Synchronous database-specific API
- Markdown scans without an index
