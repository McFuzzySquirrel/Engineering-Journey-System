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

- **Deciders:** Project maintainers
- **Date:** 2026-10-14

**Technical Story:** Replace the high-maintenance EJS session-recording system
with a searchable, scoped decision graph. The implementation plan records the
project requirement; no separate issue is associated with this pivot.

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

- **Continue and simplify EJS.** Preserve journey capture while reducing
  lifecycle and instruction overhead.
- **Replace EJS with decision-graph.** Keep durable Markdown decisions, add
  scoped rules, verification checks, SDRs, and graph relationships, and retire
  session-capture automation.
- **Keep EJS and add a separate ADR search tool.** Improve lookup without
  changing the session-recording system.

## Decision Outcome

Chosen option: replace EJS with **decision-graph**. ADRs in hybrid MADR format
are the durable source of decisions; SDRs capture session decisions and can
be promoted to ADR drafts. The `dg` CLI and shared Store interface support
SQLite locally and PostgreSQL for the server. MCP tools and a generated
`AGENTS.md` block provide agent access without session lifecycle hooks.

The existing EJS ADRs 0010–0018 are converted to deprecated hybrid ADRs and
preserved in the inactive `legacy/` archive. This ADR supersedes those records.
The database remains a rebuildable index rather than the source of truth.

## Positive Consequences

- Agents can retrieve rules by file scope and search linked decisions without
  loading whole session histories.
- Source records remain inspectable and reviewable in Git.
- The shared Store contract permits local SQLite and remote PostgreSQL backends.
- EJS-specific hooks and session capture are no longer part of the active
  development workflow.

## Negative Consequences

- Indexes must be synchronized after source records change.
- ADR conversion is heuristic and requires human review before acceptance.
- The v1 remote server has no authentication and must remain on localhost or
  a trusted network.
- Migrating EJS requires translating durable decisions; session narratives
  remain historical rather than being imported as active policy.

## Pros and Cons of the Options

### Continue and simplify EJS

- Good, because existing journeys and lifecycle tooling could be retained.
- Bad, because the system would continue to pay the maintenance and context
  costs of recording entire sessions.

### Replace EJS with decision-graph

- Good, because durable decisions become searchable, scoped, verifiable, and
  available through several agent interfaces.
- Bad, because users must migrate durable guidance and rebuild their local
  index; session narratives do not become active records.

### Keep EJS and add a separate ADR search tool

- Good, because it could improve decision lookup without changing EJS.
- Bad, because it would leave the duplicated lifecycle system in place and
  create two overlapping sources of agent guidance.

## Links

- Supersedes [ADR-0010](ADR-0010-engineering-journey-system-adoption.md)
  through [ADR-0018](ADR-0018-ejs-story-command-and-db-first.md).
- [Implementation plan](../../IMPLEMENTATION-PLAN.md)
- [Archived EJS source](../../../legacy/README.md)
