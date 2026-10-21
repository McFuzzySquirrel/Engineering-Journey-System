---
id: SDR-20261021-002
type: sdr
title: Upgrade better-sqlite3 to 13.x for N-API prebuilds
status: open
applies_to:
  - package.json
  - package-lock.json
tags: []
date: '2026-10-21'
promoted_to: null
agent: OpenCode
session: dep-upgrade-prebuild-install
---

# SDR-20261021-002: Upgrade better-sqlite3 to 13.x for N-API prebuilds

## Decision

Require better-sqlite3 ^13.0.3, which ships N-API prebuilt binaries and has no install script.

## Why

better-sqlite3 12.x pulled in the deprecated prebuild-install package; 13.x removes it and needs no compiler for supported platforms.

## Alternatives considered

None.
