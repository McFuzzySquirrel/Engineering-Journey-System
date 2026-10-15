---
id: ADR-0022
type: adr
title: Set the local browser UI accessibility baseline
status: accepted
applies_to:
  - src/ui/**
  - test/ui.test.ts
tags: [ui, accessibility]
supersedes: []
relates_to: []
derived_from:
  - SDR-20261014-013
date: 2026-10-15
deciders: [McFuzzySquirrel]
---

# ADR-0022: Set the local browser UI accessibility baseline

- **Deciders:** McFuzzySquirrel
- **Date:** 2026-10-15

**Technical Story:** [Set accessibility and responsive support baseline (#44)](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/44)

## Agent Rules

- **MUST:** Use semantic HTML, accessible names, and keyboard-operable controls with visible focus.
- **MUST:** Support screen-reader use and reflow the page at 320 CSS pixels without horizontal page scrolling.
- **MUST NOT:** Claim WCAG 2.2 AA conformance until a full conformance audit has been completed.

## Verify

- **Check:** Manual review: run npm run build, open the built UI, use only the keyboard to operate search, filters, results, and relationship navigation, inspect accessible names with a screen reader, and check reflow at 320 CSS pixels.
- **Expected:** Actions are keyboard-operable with visible focus and understandable names; the page has no horizontal overflow at 320 CSS pixels. Record any untested WCAG 2.2 AA criteria; this review alone is not a conformance certification.

## Context and Problem Statement

The selected Workbench must remain usable with assistive technology and on narrow viewports, not only on a desktop. What minimum accessibility target and responsive behavior should guide implementation and review?

## Decision Drivers

- Make every action and navigation control usable without a pointer.
- Preserve readable content and controls at narrow viewport widths.
- Provide a clear target for semantic structure, names, focus, and assistive-technology support.
- Avoid claiming conformance beyond the validation actually performed.

## Considered Options

- **Target WCAG 2.2 AA, semantic and keyboard support, screen-reader support, and 320 CSS pixel reflow.**
- **Target WCAG 2.1 AA.**
- **Provide baseline semantic and keyboard support without a stated conformance target.**

## Decision Outcome

Chosen option: target WCAG 2.2 AA, with semantic HTML, keyboard-operable controls, visible focus, screen-reader support, and reflow to 320 CSS pixels. The target is an implementation requirement, not a statement that a formal conformance audit has passed.

### Positive Consequences

- Accessibility and narrow-screen behavior are explicit acceptance criteria.
- Semantic controls and visible focus support both keyboard and assistive-technology use.
- The 320 CSS pixel requirement provides a concrete reflow check.

### Negative Consequences

- WCAG 2.2 AA requires more than a viewport smoke check; a full audit remains necessary before claiming conformance.
- Semantic and keyboard requirements may constrain future visual interactions and require ongoing review.

## Pros and Cons of the Options

### WCAG 2.2 AA with semantic, keyboard, screen-reader, and reflow requirements

- Good, because it gives the implementation a specific and current target.
- Bad, because conformance requires a broader audit than the current smoke checks.

### WCAG 2.1 AA

- Good, because it retains a recognized accessibility target.
- Bad, because it does not include the selected 2.2 success criteria.

### Baseline support without a conformance target

- Good, because it leaves implementation flexible.
- Bad, because it gives reviewers no consistent threshold for keyboard, assistive-technology, and viewport behavior.

## Links

- [Implementation issue #46](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/46)
- Derived from [SDR-20261014-013](../sdr/SDR-20261014-013-set-the-local-browser-ui-accessibility-baseline.md)
- Implemented by `src/ui/` and tested behaviorally in `test/ui.test.ts`
