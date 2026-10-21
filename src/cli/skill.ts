import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AgentSkill } from '../core/index.js';

export const SKILL_VERSION = 1;
export const SKILL_NAME = 'decision-graph';

const SKILL_DIRECTORIES: Record<Exclude<AgentSkill, 'none'>, string> = {
  agents: `.agents/skills/${SKILL_NAME}`,
  opencode: `.opencode/skills/${SKILL_NAME}`,
  claude: `.claude/skills/${SKILL_NAME}`,
};

const VERSION_MARKER = /<!-- dg-skill-version: (\d+) -->/;

export interface SkillProvisionResult {
  path: string;
  action: 'created' | 'updated' | 'unchanged' | 'skipped';
}

export function findProvisionedSkill(root: string): string | undefined {
  for (const directory of Object.values(SKILL_DIRECTORIES)) {
    const relative = `${directory}/SKILL.md`;
    if (existsSync(path.join(root, relative))) return relative;
  }
  return undefined;
}

export function provisionDecisionSkill(
  root: string,
  target: AgentSkill,
): SkillProvisionResult | undefined {
  if (target === 'none') return undefined;
  const directory = SKILL_DIRECTORIES[target];
  const skillFile = path.join(root, directory, 'SKILL.md');
  const referenceFile = path.join(
    root,
    directory,
    'references',
    'legacy-adr-formats.md',
  );
  if (existsSync(skillFile)) {
    const current = readFileSync(skillFile, 'utf8');
    if (!VERSION_MARKER.test(current)) {
      return { path: `${directory}/SKILL.md`, action: 'skipped' };
    }
  }
  const actions = [
    writeManagedFile(skillFile, SKILL_TEMPLATE),
    writeManagedFile(referenceFile, LEGACY_FORMATS_TEMPLATE),
  ];
  const action = actions.includes('created')
    ? 'created'
    : actions.includes('updated')
      ? 'updated'
      : actions.includes('skipped')
        ? 'skipped'
        : 'unchanged';
  return { path: `${directory}/SKILL.md`, action };
}

function writeManagedFile(
  file: string,
  content: string,
): SkillProvisionResult['action'] {
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    return 'created';
  }
  const current = readFileSync(file, 'utf8');
  if (current === content) return 'unchanged';
  const version = current.match(VERSION_MARKER)?.[1];
  if (!version) return 'skipped';
  if (Number(version) > SKILL_VERSION) return 'skipped';
  writeFileSync(file, content);
  return 'updated';
}

const SKILL_TEMPLATE = `---
name: ${SKILL_NAME}
description: Use in a repository managed by the decision-graph CLI (\`dg\`) when triaging parse or lint failures, migrating legacy ADRs, capturing session decisions, or loading scoped decision rules before editing code.
---

# Decision Graph

<!-- dg-skill-version: ${SKILL_VERSION} -->

Use the installed \`dg\` CLI. Never edit \`.dg/graph.db\` or \`.dg/config.json\` by hand.

## Before editing code

1. Run \`dg context <files>\` to load accepted rules that apply to the paths you will touch.
2. Follow those rules; they come from versioned Markdown records, not from this skill.

## After a significant decision

Capture it with \`dg sdr add "<title>" --decision "<what>" --why "<why>"\`.
Promote it with \`dg sdr promote <id>\` when it becomes an ADR. Let \`dg adr create\` allocate IDs; do not invent them.

## Triage parse and lint failures

1. Run \`dg lint --json\` and read \`diagnostics\`.
2. A \`schema\` diagnostic means the file could not be parsed. Run \`dg import <path>\` to see the exact error for one file.
3. Fix the source Markdown. Prefer adding explicit frontmatter (\`id\`, \`type\`, \`title\`, \`status\`, \`date\`) over renaming files.
4. Run \`dg sync\`, then \`dg lint --json\` again.

## Migrating legacy ADRs

- Accepted without frontmatter: \`# ADR-0001: Title\`, \`# ADR 001: Title\`, and numbered filenames such as \`0001-title.md\`, \`ADR-0001-title.md\`, or \`ADR_001-title.md\`.
- Inline \`**Status:**\`, \`**Date:**\`, and \`**Tags:**\` lines before the first \`##\` heading are read when frontmatter is absent.
- \`dg import <path> --convert\` writes a proposed hybrid draft and keeps the original. Review the draft before accepting it.
- Preserve source digits: \`ADR-001\` stays \`ADR-001\`. Do not renumber existing records.
- See \`references/legacy-adr-formats.md\` for supported shapes.

## Guardrails

- Do not delete or rewrite source ADRs unless the user asks.
- Do not guess a missing ID or title; report the exact \`dg\` error with the file path instead.
- Re-run \`dg sync\` after editing record files so the index and graph stay current.
`;

const LEGACY_FORMATS_TEMPLATE = `# Legacy ADR formats

<!-- dg-skill-version: ${SKILL_VERSION} -->

The decision-graph parser accepts four shapes. Detect the shape with \`dg import <path>\` or by reading the file.

## Hybrid MADR (native)

YAML frontmatter with \`id\`, \`type\`, \`title\`, and \`status\`, followed by Markdown sections such as \`## Agent Rules\`, \`## Verify\`, and \`## Decision Outcome\`.

## MADR

A \`# Title\` heading plus sections such as \`## Status\`, \`## Context and Problem Statement\`, and \`## Decision Outcome\`. IDs come from numbered filenames or an \`ADR-0001\` heading.

## Nygard / adr-tools

A \`# Title\` heading plus \`## Status\`, \`## Context\`, \`## Decision\`, and \`## Consequences\`. Files are usually named \`0001-title.md\`.

## Agent-optimized

Frontmatter with \`rules\` or \`verify\` fields, optionally with an \`## Agent Rules\` section.

## Inline metadata

When frontmatter is absent, these lines before the first \`##\` heading are read:

\`\`\`markdown
# ADR 001: Village Hub

**Status:** Accepted
**Date:** 2026-06-16
**Tags:** architecture, ux
\`\`\`

## Unsupported shapes

If \`dg\` reports that it cannot determine an id, add frontmatter rather than renaming the file:

\`\`\`markdown
---
id: ADR-001
type: adr
title: Village Hub
status: accepted
date: 2026-06-16
---
\`\`\`
`;

export { SKILL_TEMPLATE, LEGACY_FORMATS_TEMPLATE };
