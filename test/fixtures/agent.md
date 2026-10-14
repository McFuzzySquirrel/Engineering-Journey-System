---
id: ADR-0002
type: adr
title: Keep decision files in Markdown
status: accepted
applies_to:
  - "docs/decisions/**"
rules:
  - modality: MUST
    text: Keep source records in Markdown.
verify:
  - check: npm test
    expected: All tests pass.
---

# Keep decision files in Markdown

## Context

The records must be reviewable in version control.
