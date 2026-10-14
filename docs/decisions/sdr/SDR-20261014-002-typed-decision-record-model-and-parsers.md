---
id: SDR-20261014-002
type: sdr
title: Typed decision record model and parsers
status: open
applies_to:
  - src/core/**
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 2
---

# SDR-20261014-002: Typed decision record model and parsers

## Decision

Use Zod schemas and a hybrid MADR native format with import support for MADR, agent-optimized, and Nygard records.

## Why

A validated shared model gives each parser consistent records while preserving compatibility with established ADR formats.

## Alternatives considered

- One custom format only
- Untyped parser-specific data
