---
id: SDR-20261014-001
type: sdr
title: Package and runtime contract
status: open
applies_to:
  - package.json
  - tsconfig.json
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 1
---

# SDR-20261014-001: Package and runtime contract

## Decision

Distribute an ESM TypeScript CLI named decision-graph with the dg binary and Node.js 26 or newer.

## Why

A typed ESM package and explicit runtime floor support the native SQLite dependency and reproducible npm distribution.

## Alternatives considered

- Plain JavaScript with no type checking
- CommonJS and older Node support
