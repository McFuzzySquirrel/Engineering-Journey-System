---
id: SDR-20261014-010
type: sdr
title: Serve the browser UI from dg serve
status: open
applies_to:
  - src/server/http.ts
  - src/cli/commands.ts
  - src/ui/**
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
---

# SDR-20261014-010: Serve the browser UI from dg serve

## Decision

Serve the built browser UI assets from the existing dg serve HTTP process at the same origin as the JSON API; use Vite development server with an API proxy during development. Preserve the localhost-only access boundary.

## Why

A single production process fits the local-only UI, reuses the existing server, avoids CORS, and aligns with the accepted server architecture and localhost security rule.

## Alternatives considered

- Run a separate local frontend process in production and connect it to the API across origins.
