---
id: ADR-0019
type: adr
title: Serve the browser UI from dg serve
status: accepted
applies_to:
  - src/server/http.ts
  - src/cli/commands.ts
  - src/ui/**
  - vite.config.ts
tags: [ui, server]
supersedes: []
relates_to:
  - ADR-0001
derived_from:
  - SDR-20261014-010
date: 2026-10-15
deciders: [McFuzzySquirrel]
---

# ADR-0019: Serve the browser UI from dg serve

- **Deciders:** McFuzzySquirrel
- **Date:** 2026-10-15

**Technical Story:** [Choose how the local UI is served (#41)](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/41)

## Agent Rules

- **MUST:** Serve production UI assets from the existing `dg serve` process at the same origin as its API.
- **MUST:** Keep the unauthenticated server bound to localhost or a trusted network.
- **MUST:** Use Vite with an API proxy for development; do not require a separate frontend service in production.
- **SHOULD:** Keep built browser assets in the package output so a local package installation can serve the UI.

## Verify

- **Check:** npm run build && npm test -- --run test/remote.test.ts
- **Expected:** The production build includes the UI, and the server integration test serves the page and its same-origin API.
- **Check:** npm pack --dry-run --json
- **Expected:** The package file list includes `dist/ui/index.html` and the built UI assets.

## Context and Problem Statement

The local explorer needs a production serving model and a development workflow that can reach the existing records API. Should production run a separate frontend process, or should `dg serve` serve the built UI and API together?

## Decision Drivers

- Keep the UI local and within the server's existing network boundary.
- Avoid cross-origin configuration and a second production process.
- Preserve a fast frontend development loop.
- Make UI files available in the installed package.

## Considered Options

- **Serve built UI assets from `dg serve`; use Vite only for development.**
- **Run a separate frontend service in production and connect it to the API across origins.**
- **Use the Vite development server as the production server.**

## Decision Outcome

Chosen option: serve built UI assets from `dg serve` and use Vite with an API proxy during development. This reuses the existing local server and keeps browser API requests same-origin while allowing Vite's development workflow.

### Positive Consequences

- Users start one process for the UI and API.
- Same-origin requests avoid a separate CORS policy.
- The production UI inherits the server's localhost/trusted-network boundary.

### Negative Consequences

- The UI is unavailable unless the HTTP server is running.
- The server package must include the generated UI files in addition to the CLI bundle.
- The local API remains unauthenticated; operators must not expose it to untrusted networks.

## Pros and Cons of the Options

### Built assets served by `dg serve`

- Good, because it reuses the existing process and same-origin API.
- Good, because production does not need a separate frontend service.
- Bad, because the server build and package must carry the browser assets.

### Separate production frontend service

- Good, because frontend and API could be deployed independently.
- Bad, because it adds a process, cross-origin configuration, and a broader access boundary for a local-only UI.

### Vite in production

- Good, because development and production could share a server command.
- Bad, because a development server is not the selected static production serving model.

## Links

- [Implementation issue #46](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/46)
- Derived from [SDR-20261014-010](../sdr/SDR-20261014-010-serve-the-browser-ui-from-dg-serve.md)
- Related: [ADR-0001](ADR-0001-pivot-from-ejs-to-decision-graph.md)
- Implemented by `src/server/http.ts`, `src/ui/`, and `vite.config.ts`
