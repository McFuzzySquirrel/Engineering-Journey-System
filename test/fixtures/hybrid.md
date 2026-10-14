---
id: ADR-0001
type: adr
title: Use a framework image component
status: accepted
applies_to:
  - "**/*.tsx"
tags:
  - frontend
date: 2026-10-13
deciders:
  - Frontend team
supersedes: []
relates_to: []
derived_from: []
---

# ADR-0001: Use a framework image component

## Agent Rules

- **MUST:** Render images with the framework image component.
- **SHOULD NOT:** Use unoptimized image sources.

## Verify

- **Check:** npm test
- **Expected:** All tests pass.

## Context and Problem Statement

Raw images can cause layout shift.

## Decision Drivers

- Improve performance.
- Avoid layout shift.

## Considered Options

- Use the framework image component.
- Use raw HTML images.

## Decision Outcome

Use the framework image component.

## Positive Consequences

- Images are optimized.

## Negative Consequences

- Callers provide dimensions.

## Pros and Cons of the Options

### Framework component

- Good, because it optimizes images.

## Links

None.
