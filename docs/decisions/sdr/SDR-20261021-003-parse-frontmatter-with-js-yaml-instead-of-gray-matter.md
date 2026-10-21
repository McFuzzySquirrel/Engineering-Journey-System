---
id: SDR-20261021-003
type: sdr
title: Parse frontmatter with js-yaml instead of gray-matter
status: open
applies_to:
  - src/core/parse/**
  - package.json
  - package-lock.json
tags: []
date: '2026-10-21'
promoted_to: null
agent: OpenCode
session: dep-upgrade-prebuild-install
---

# SDR-20261021-003: Parse frontmatter with js-yaml instead of gray-matter

## Decision

Read YAML frontmatter directly from the leading delimiter block and remove the gray-matter dependency and the root js-yaml override.

## Why

gray-matter pins js-yaml 3.x, so package consumers inherited vulnerable argparse and sprintf-js versions; direct js-yaml 4 parsing keeps one supported parser.

## Alternatives considered

None.
