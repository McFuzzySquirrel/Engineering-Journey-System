import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { parseRecord } from '../src/core/index.js';
import { SQLiteStore } from '../src/store/index.js';

let directory: string;
let store: SQLiteStore;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'decision-graph-'));
  store = new SQLiteStore(join(directory, 'graph.db'));
  await store.upsertProject({
    id: 'project-a',
    name: 'Project A',
    type: 'cli-tool',
  });
  await store.upsertProject({
    id: 'project-b',
    name: 'Project B',
    type: 'library',
  });
});

afterEach(async () => {
  store.close();
  await rm(directory, { recursive: true, force: true });
});

it('upserts nodes idempotently and keeps projects isolated', async () => {
  const adr = makeAdr('ADR-0001', 'Use SQLite', ['src/**/*.ts']);

  await expect(store.upsertNode('project-a', adr)).resolves.toBe(true);
  await expect(store.upsertNode('project-a', adr)).resolves.toBe(false);
  await expect(store.get('project-a', adr.id)).resolves.toMatchObject({
    id: adr.id,
    title: 'Use SQLite',
    rules: [{ id: 'ADR-0001#1', modality: 'MUST' }],
  });
  await expect(store.get('project-b', adr.id)).resolves.toBeNull();
});

it('deletes stale nodes, their edges, and full-text entries', async () => {
  const first = makeAdr('ADR-0001', 'Keep SQLite', ['src/**']);
  const stale = makeAdr('ADR-0002', 'Remove PostgreSQL', ['src/**']);
  await store.upsertNode('project-a', first);
  await store.upsertNode('project-a', stale);
  await store.addEdge('project-a', first.id, stale.id, 'relates_to');

  await expect(store.deleteMissing('project-a', [first.id])).resolves.toBe(1);
  await expect(store.get('project-a', stale.id)).resolves.toBeNull();
  await expect(store.related('project-a', first.id, 2)).resolves.toEqual([]);
  await expect(store.search('project-a', 'PostgreSQL')).resolves.toEqual([]);
});

it('traverses only selected edge kinds and respects depth', async () => {
  const first = makeAdr('ADR-0001', 'First', ['src/**']);
  const second = makeAdr('ADR-0002', 'Second', ['src/**']);
  const third = makeAdr('ADR-0003', 'Third', ['src/**']);
  for (const record of [first, second, third]) {
    await store.upsertNode('project-a', record);
  }
  await store.addEdge('project-a', first.id, second.id, 'relates_to');
  await store.addEdge('project-a', second.id, third.id, 'supersedes');
  await store.addEdge('project-a', third.id, first.id, 'relates_to');

  await expect(store.related('project-a', first.id, 1)).resolves.toMatchObject([
    { id: second.id },
  ]);
  await expect(store.related('project-a', first.id, 2)).resolves.toMatchObject([
    { id: second.id },
    { id: third.id },
  ]);
  await expect(
    store.related('project-a', first.id, 3, ['relates_to']),
  ).resolves.toMatchObject([{ id: second.id }]);
  await expect(store.related('project-a', first.id, 101)).rejects.toThrow(
    RangeError,
  );
});

it('sanitizes FTS operators and searches punctuation-containing terms', async () => {
  const adr = makeAdr('ADR-0001', 'Use sub-agent workflows', ['src/**']);
  await store.upsertNode('project-a', adr);

  await expect(store.search('project-a', 'sub-agent')).resolves.toMatchObject([
    { id: adr.id, title: adr.title },
  ]);
  await expect(store.search('project-a', 'OR * "')).resolves.toEqual([]);
  await expect(store.search('project-a', '   ')).resolves.toEqual([]);
  await expect(
    store.search('project-a', 'sub-agent', { status: 'proposed' }),
  ).resolves.toEqual([]);
});

it('matches any requested file against node globs', async () => {
  const frontend = makeAdr('ADR-0001', 'Frontend', ['src/**/*.tsx']);
  const backend = makeAdr('ADR-0002', 'Backend', ['server/**/*.ts']);
  await store.upsertNode('project-a', frontend);
  await store.upsertNode('project-a', backend);

  await expect(
    store.byGlobMatch('project-a', ['src/view/page.tsx', 'README.md']),
  ).resolves.toMatchObject([{ id: frontend.id }]);
  await expect(store.byGlobMatch('project-a', [])).resolves.toEqual([]);
});

function makeAdr(id: string, title: string, appliesTo: string[]) {
  return parseRecord(
    `---
id: ${id}
type: adr
title: ${title}
status: accepted
applies_to: ${JSON.stringify(appliesTo)}
tags: [storage]
---

# ${id}: ${title}

## Agent Rules

- **MUST:** Keep the source record in Markdown.

## Verify

- **Check:** npm test
- **Expected:** Tests pass.

## Context and Problem Statement

This decision documents ${title}.
`,
    `docs/decisions/adr/${id}.md`,
    'hybrid',
  );
}
