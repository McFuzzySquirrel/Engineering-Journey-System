---
id: ADR-0023
type: adr
title: Render decision-record Markdown safely in the browser UI
status: accepted
applies_to:
  - src/ui/**
  - test/ui.test.ts
tags: [ui, markdown, security]
supersedes: []
relates_to: []
derived_from:
  - SDR-20261014-014
date: 2026-10-15
deciders: [McFuzzySquirrel]
---

# ADR-0023: Render decision-record Markdown safely in the browser UI

- **Deciders:** McFuzzySquirrel
- **Date:** 2026-10-15

**Technical Story:** [Choose safe rendering for decision-record details (#45)](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/45)

## Agent Rules

- **MUST:** Disable raw HTML in Markdown parsing and sanitize rendered HTML before inserting it into the document.
- **MUST:** Exclude images and active or embedded media so viewing a record does not fetch remote embeds.
- **MUST:** Give external links `target="_blank"` with `rel="noopener noreferrer"`; leave same-origin links in the current browsing context.
- **MUST:** Show the record source path and update time in the inspector.

## Verify

- **Check:** npm test -- --run test/ui.test.ts test/remote.test.ts
- **Expected:** Tests confirm raw markup does not become active HTML, unsafe links and remote images are not rendered, external links are protected, and the record API supplies the detail shown by the UI.

## Context and Problem Statement

Decision records are Markdown and may contain untrusted content. How can the inspector keep records readable and show their provenance without executing embedded HTML or loading remote media?

## Decision Drivers

- Keep Markdown as the canonical editable source outside the UI.
- Render headings, lists, code, and other Markdown structure for readability.
- Prevent raw HTML and active content from executing.
- Avoid remote image or media requests while browsing local records.
- Preserve provenance and keep the browser experience read-only.

## Considered Options

- **Render Markdown with raw HTML disabled and sanitize the result.**
- **Display the raw Markdown source as plain text.**
- **Insert rendered Markdown without sanitization.**

## Decision Outcome

Chosen option: render sanitized Markdown with raw HTML disabled. Permit safe links, open external links in a protected new tab, and forbid embedded remote images and active media. Show source path and update time in the inspector.

### Positive Consequences

- Record structure is readable without treating Markdown as trusted HTML.
- Dangerous markup and remote embedded media are excluded from the inspector.
- External links cannot access the opener window.
- The source path and update time make the displayed record traceable.

### Negative Consequences

- Images and embedded media are intentionally unavailable in the inspector.
- Markdown rendering and sanitization rules must stay aligned as the renderer changes.

## Pros and Cons of the Options

### Sanitized Markdown with raw HTML disabled

- Good, because common Markdown structure remains readable while raw HTML is not trusted.
- Good, because sanitizer policy can remove active content and remote embeds.
- Bad, because embedded images and media are not displayed.

### Plain Markdown source

- Good, because no HTML rendering step is needed.
- Bad, because headings, links, and code are less readable to users browsing decisions.

### Unsanitized rendered Markdown

- Good, because it is the simplest rendering pipeline.
- Bad, because untrusted record content could introduce executable markup or remote content.

## Links

- [Implementation issue #46](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/46)
- Derived from [SDR-20261014-014](../sdr/SDR-20261014-014-render-decision-record-markdown-safely-in-the-browser-ui.md)
- Implemented by `src/ui/markdown.ts` and `src/ui/main.ts`
- Tests: `test/ui.test.ts` and `test/remote.test.ts`
