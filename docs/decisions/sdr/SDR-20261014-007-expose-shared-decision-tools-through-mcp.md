---
id: SDR-20261014-007
type: sdr
title: Expose shared decision tools through MCP
status: open
applies_to:
  - src/mcp/**
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: Implementation plan phase 7
---

# SDR-20261014-007: Expose shared decision tools through MCP

## Decision

Register shared decision tools for the stdio MCP server using the same store-backed services as the CLI.

## Why

A standard protocol makes decision queries available to agent clients without duplicating decision logic.

## Alternatives considered

- Custom client integrations
- Read-only filesystem access only
