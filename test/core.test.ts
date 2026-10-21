import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  detectFormat,
  parseConfig,
  parseRecord,
  RecordParseError,
} from '../src/core/index.js';

const fixture = (name: string) =>
  readFile(resolve('test/fixtures', name), 'utf8');

it('parses hybrid ADR rules, checks, sections, and stable rule ids', async () => {
  const source = await fixture('hybrid.md');
  const record = parseRecord(source, 'docs/decisions/adr/ADR-0001-image.md');

  expect(record.type).toBe('adr');
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.rules.map(({ id, modality }) => [id, modality])).toEqual([
    ['ADR-0001#1', 'MUST'],
    ['ADR-0001#2', 'SHOULD NOT'],
  ]);
  expect(record.verify).toEqual([
    { check: 'npm test', expected: 'All tests pass.' },
  ]);
  expect(record.context).toContain('layout shift');
  expect(record.decisionDrivers).toEqual([
    'Improve performance.',
    'Avoid layout shift.',
  ]);
  expect(record.prosAndCons).toEqual(['Good, because it optimizes images.']);
  expect(record.contentHash).toMatch(/^[a-f0-9]{64}$/);
});

it('imports a MADR record and derives its id from a numbered filename', async () => {
  const source = await fixture('madr.md');
  const record = parseRecord(source, 'docs/adr/0007-local-database.md');

  expect(record.id).toBe('ADR-0007');
  expect(record.status).toBe('accepted');
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.decisionOutcome).toContain('SQLite');
  expect(record.consideredOptions).toEqual(['SQLite', 'PostgreSQL']);
  expect(record.prosAndCons).toEqual(['Good, because SQLite is portable.']);
  expect(record.consequences).toEqual([
    'The database is local to each checkout.',
  ]);
});

it('imports agent frontmatter rules and detects that format', async () => {
  const source = await fixture('agent.md');

  expect(detectFormat(source, 'ADR-0002.md')).toBe('agent');
  const record = parseRecord(source, 'ADR-0002.md');
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.rules[0]).toEqual({
    id: 'ADR-0002#1',
    modality: 'MUST',
    text: 'Keep source records in Markdown.',
  });
  expect(record.verify).toHaveLength(1);
});

it('detects hybrid ADRs without an explicit Agent Rules section', () => {
  expect(
    detectFormat(
      '---\nid: ADR-0003\ntype: adr\ntitle: Record rationale\nstatus: accepted\n---\n\n## Context and Problem Statement\n\nKeep the rationale.',
      'ADR-0003-record-rationale.md',
    ),
  ).toBe('hybrid');
});

it('keeps horizontal rules in MADR documents out of frontmatter detection', () => {
  const source = `# Use SQLite

## Status

Accepted

---

## Decision Outcome

Use SQLite.
`;

  expect(detectFormat(source, 'ADR-0008-local-database.md')).toBe('madr');
  const record = parseRecord(source, 'ADR-0008-local-database.md');
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.decisionOutcome).toBe('Use SQLite.');
});

it('detects and parses native SDR frontmatter', () => {
  const source = `---
id: SDR-20261013-001
type: sdr
title: Use zod
status: open
---

## Decision

Use zod.

## Why

Typed parse results.

## Alternatives considered

- ajv + JSON Schema

- hand-rolled checks
`;

  expect(detectFormat(source, 'SDR-20261013-001-use-zod.md')).toBe('hybrid');
  const record = parseRecord(source, 'SDR-20261013-001-use-zod.md');
  expect(record.type).toBe('sdr');
  if (record.type !== 'sdr') throw new Error('expected SDR');
  expect(record.alternatives).toEqual([
    'ajv + JSON Schema',
    'hand-rolled checks',
  ]);
});

it('imports Nygard records and recognizes superseding links', async () => {
  const source = await fixture('0012-local-first.md');
  const record = parseRecord(source, 'docs/adr/0012-local-first.md');

  expect(detectFormat(source, 'docs/adr/0012-local-first.md')).toBe('nygard');
  expect(record.id).toBe('ADR-0012');
  expect(record.status).toBe('superseded');
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.supersedes).toEqual([]);
  expect(record.relatesTo).toEqual(['ADR-0013']);
  expect(record.positiveConsequences).toEqual([
    'Records remain available without a server.',
  ]);
});

it('imports short-numbered legacy ADRs with inline metadata and decision subsections', () => {
  const source = `# ADR 001: Village Hub

**Status:** Proposed
**Date:** 2026-06-16
**Tags:** architecture, ux

## Context

Players need a hub.

## Decision

Build a hub.

## Decision 1: Phaser village

Use Phaser for the village.

## Decision 2: React overlays

Keep HUD panels in React.
`;

  expect(detectFormat(source, 'docs/adr/001-village-hub.md')).toBe('nygard');
  const record = parseRecord(source, 'docs/adr/001-village-hub.md');
  expect(record.id).toBe('ADR-001');
  expect(record.title).toBe('Village Hub');
  expect(record.status).toBe('proposed');
  expect(record.date).toBe('2026-06-16');
  expect(record.tags).toEqual(['architecture', 'ux']);
  if (record.type !== 'adr') throw new Error('expected ADR');
  expect(record.decisionOutcome).toContain('Build a hub.');
  expect(record.decisionOutcome).toContain('Use Phaser for the village.');
  expect(record.decisionOutcome).toContain('Keep HUD panels in React.');
});

it('infers a spaced ADR heading and preserves the source digits', () => {
  const source = `# ADR_004: Use a queue

## Decision

Queue writes.
`;

  const record = parseRecord(source, 'docs/adr/notes.md');
  expect(record.id).toBe('ADR-004');
  expect(record.title).toBe('Use a queue');
});

it('does not treat a plain numbered heading as an ADR id', () => {
  expect(() =>
    parseRecord(
      '# 2024 Roadmap\n\n## Decision\n\nShip it.',
      'docs/adr/notes.md',
    ),
  ).toThrow(/could not determine ADR id/);
});

it('ignores inline status lines that appear after the first section', () => {
  const record = parseRecord(
    '# ADR-0005: Scoped status\n\n## Context\n\n**Status:** Proposed\n',
    'docs/adr/ADR-0005-scoped-status.md',
  );
  expect(record.status).toBe('accepted');
});

it('reports frontmatter validation errors with file and field names', () => {
  expect(() =>
    parseRecord(
      '---\nid: ADR-0001\ntype: adr\ntitle: Test\nstatus: accepted\napplies_to: invalid\n---\n# Test',
      'docs/adr/bad.md',
      'hybrid',
    ),
  ).toThrow(/docs\/adr\/bad\.md: invalid record \(applies_to:/);
});

it('validates project configuration and reports invalid fields', () => {
  const valid = parseConfig(
    JSON.stringify({
      project: 'decision-graph',
      projectType: 'cli-tool',
      adrDir: 'docs/decisions/adr',
      sdrDir: 'docs/decisions/sdr',
      agentsMd: 'AGENTS.md',
      tokenBudget: 1500,
      remote: null,
    }),
    '.dg/config.json',
  );
  expect(valid.projectType).toBe('cli-tool');

  expect(() => parseConfig('{"project":"demo"}', '.dg/config.json')).toThrow(
    /\.dg\/config\.json: invalid record \(projectType:/,
  );
});

it('parses empty frontmatter, CRLF line endings, and a leading BOM', () => {
  const empty = parseRecord(
    '---\n---\n# ADR-0006: Empty frontmatter\n\n## Decision\n\nUse it.',
    'docs/adr/ADR-0006-empty.md',
  );
  expect(empty.id).toBe('ADR-0006');
  expect(empty.title).toBe('Empty frontmatter');
  expect(empty.body).toContain('## Decision');

  const crlf = parseRecord(
    '---\r\nid: ADR-0007\r\ntype: adr\r\ntitle: CRLF record\r\nstatus: accepted\r\n---\r\n\r\n# ADR-0007: CRLF record\r\n',
    'docs/adr/ADR-0007-crlf.md',
    'hybrid',
  );
  expect(crlf.id).toBe('ADR-0007');
  expect(crlf.title).toBe('CRLF record');

  const bom = parseRecord(
    '\uFEFF---\nid: ADR-0008\ntype: adr\ntitle: BOM record\nstatus: accepted\n---\n\n# ADR-0008: BOM record\n',
    'docs/adr/ADR-0008-bom.md',
    'hybrid',
  );
  expect(bom.id).toBe('ADR-0008');
  expect(bom.title).toBe('BOM record');
});

it('rejects frontmatter that is not a YAML mapping', () => {
  expect(() =>
    parseRecord('---\n- a\n- b\n---\nBody', 'docs/adr/list.md', 'hybrid'),
  ).toThrow(/frontmatter must be a YAML mapping/);
});

it('rejects malformed frontmatter without crashing', () => {
  expect(() => parseRecord('---\nid: [\n---\n# Broken', 'broken.md')).toThrow(
    RecordParseError,
  );
});
