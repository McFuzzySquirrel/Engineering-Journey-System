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

it('rejects malformed frontmatter without crashing', () => {
  expect(() => parseRecord('---\nid: [\n---\n# Broken', 'broken.md')).toThrow(
    RecordParseError,
  );
});
