---
id: ADR-0001
type: adr
title: Pivot from EJS to decision-graph
status: accepted
applies_to: ["**/*"]
tags: [architecture, project-direction, decision-graph]
supersedes:
  - ADR-0010
  - ADR-0011
  - ADR-0012
  - ADR-0013
  - ADR-0014
  - ADR-0015
  - ADR-0016
  - ADR-0017
  - ADR-0018
relates_to: []
derived_from: []
date: 2026-10-14
deciders: [Project maintainers]
---

# ADR-0001: Pivot from EJS to decision-graph

## Agent Rules

- **MUST:** Treat versioned Markdown decision records as the source of truth; rebuild the local index from those files.
- **MUST NOT:** Run archived EJS hooks, skills, bootstrap scripts, or session-recording workflows.
- **SHOULD:** Run `dg context <files...>` before editing code and use `dg sdr add` to capture significant session decisions.
- **MUST:** Keep unauthenticated decision-graph servers bound to localhost or a trusted network.

## Verify

- **Check:** `node -e "const fs = require('node:fs'); if (!fs.existsSync('docs/decisions/adr/ADR-0001-pivot-from-ejs-to-decision-graph.md') || !fs.existsSync('docs/decisions/sdr') || !fs.existsSync('legacy/ejs-docs/adr/0010-engineering-journey-system-adoption.md')) process.exit(1)"`
- **Expected:** The active ADR and SDR directories exist, and the source EJS archive remains preserved.
- **Check:** `node -e "const fs = require('node:fs'); if (!fs.readFileSync('.github/workflows/ci.yml', 'utf8').includes('node dist/cli.js lint') || !fs.readFileSync('.github/workflows/ci.yml', 'utf8').includes('node dist/cli.js verify')) process.exit(1)"`
- **Expected:** CI runs both decision-graph lint and verification.

## Context and Problem Statement

The Engineering Journey System recorded entire agent sessions using journey
files, hooks, prompt logs, skills, and narrative artifacts. That system had a
large maintenance and context cost, and its lifecycle automation was coupled
to particular agent tooling. The durable decisions embedded in its ADRs are
useful, but session transcripts and automatic recording are not the right
source of reusable engineering guidance.

This repository is being rebuilt in place as decision-graph: a Node.js and
TypeScript tool that indexes scoped architecture decisions, captures smaller
session decisions, and exposes those records through a CLI, MCP, and a
multi-project server.

## Decision Drivers

- Make durable decisions and applicable rules easy for developers and agents
  to find, follow, and verify.
- Keep human-readable Markdown as the canonical data, with a rebuildable index.
- Reduce always-on agent context and avoid session-recording hooks.
- Preserve useful historical EJS decisions without continuing to enforce them.
- Support local single-project use and remote multi-project access through one
  Store contract.

## Considered Options

- Continue EJS and incrementally simplify its journey lifecycle, instructions,
  and hooks.
- Replace EJS with a Markdown decision graph containing ADRs, SDRs, scoped
  rules, verification checks, and relationships.
- Retain EJS as the active system and add an independent ADR search tool.

## Decision Outcome

Chosen option: replace EJS with **decision-graph**. ADRs in hybrid MADR format
are the durable source of decisions; SDRs capture session decisions and can
be promoted to ADR drafts. The `dg` CLI and shared Store interface support
SQLite locally and PostgreSQL for the server. MCP tools and a generated
`AGENTS.md` block provide agent access without session lifecycle hooks.

The existing EJS ADRs 0010–0018 are converted to deprecated hybrid ADRs and
preserved in the inactive `legacy/` archive. This ADR supersedes those records.
The database remains a rebuildable index rather than the source of truth.

## Consequences

### Positive

- Agents can retrieve rules by file scope and search linked decisions without
  loading whole session histories.
- Source records remain inspectable and reviewable in Git.
- The shared Store contract permits local SQLite and remote PostgreSQL backends.
- EJS-specific hooks and session capture are no longer part of the active
  development workflow.

### Trade-offs

- Indexes must be synchronized after source records change.
- ADR conversion is heuristic and requires human review before acceptance.
- The v1 remote server has no authentication and must remain on localhost or
  a trusted network.
- Migrating EJS requires translating durable decisions; session narratives
  remain historical rather than being imported as active policy.
