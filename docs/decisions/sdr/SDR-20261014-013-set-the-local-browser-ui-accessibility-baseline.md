---
id: SDR-20261014-013
type: sdr
title: Set the local browser UI accessibility baseline
status: open
applies_to:
  - src/ui/**
  - test/ui.test.ts
tags: []
date: '2026-10-14'
promoted_to: null
agent: Copilot
session: 'Wayfinder issue #44'
---

# SDR-20261014-013: Set the local browser UI accessibility baseline

## Decision

Target WCAG 2.2 AA. Use semantic HTML; make every action and navigation control keyboard-operable with visible focus and accessible names; support screen readers; and reflow at 320 CSS pixels without horizontal page scrolling.

## Why

The selected Workbench must remain usable across assistive technologies and narrow viewports, not only on desktop. The user accepted the recommended baseline.

## Alternatives considered

- Target WCAG 2.1 AA.
- Provide only baseline semantic and keyboard accessibility without a stated conformance target.
