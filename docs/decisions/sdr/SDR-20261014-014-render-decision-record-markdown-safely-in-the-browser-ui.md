---
id: SDR-20261014-014
type: sdr
title: Render decision-record Markdown safely in the browser UI
status: promoted
applies_to:
  - src/ui/**
  - test/ui.test.ts
tags: []
date: '2026-10-14'
promoted_to: ADR-0023
agent: Copilot
session: 'Wayfinder issue #45'
---

# SDR-20261014-014: Render decision-record Markdown safely in the browser UI

## Decision

Render sanitized Markdown with raw HTML disabled; only allow safe links, open external links in a protected new tab, and do not fetch embedded remote images. Show the source path and updated time in the record inspector, and keep the UI read-only.

## Why

Contributors need readable record content while the local server remains safe to use with untrusted Markdown. The user selected the recommended rendering and provenance baseline.

## Alternatives considered

- Display raw Markdown source as plain text.
