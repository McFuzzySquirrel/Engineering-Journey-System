---
id: SDR-20261014-008
type: sdr
title: Add multi-project server and remote sync
status: open
applies_to:
  - src/server/**
  - src/store/postgres.ts
  - src/store/transfer.ts
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 8
---

# SDR-20261014-008: Add multi-project server and remote sync

## Decision

Support SQLite or PostgreSQL server storage, a shared HTTP and MCP interface, and explicit push/pull synchronization.

## Why

The shared Store enables multi-project use while pull keeps remote data in a separate namespace and does not overwrite source files.

## Alternatives considered

- Single-project local-only operation
- Remote writes directly to repository files
