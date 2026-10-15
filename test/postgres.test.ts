import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { parseRecord } from '../src/core/index.js';
import { PostgresStore } from '../src/store/postgres.js';

const connectionString = process.env.DG_TEST_PG_URL;
const projectId = `phase8-test-${randomUUID()}`;

describe.skipIf(!connectionString)('PostgresStore', () => {
  it('upserts idempotently, scopes projects, searches, and traverses edges', async () => {
    const store = new PostgresStore(connectionString!);
    try {
      await store.upsertProject({
        id: projectId,
        name: 'Postgres integration test',
        type: 'library',
      });
      await store.upsertProject({
        id: `${projectId}-other`,
        name: 'Other project',
        type: 'app',
      });
      const first = makeAdr('ADR-0001', 'Use Postgres for remote storage.', [
        'storage',
      ]);
      const second = makeAdr('ADR-0002', 'Keep records searchable.', [
        'search',
      ]);
      await expect(store.upsertNode(projectId, first)).resolves.toBe(true);
      await expect(store.upsertNode(projectId, first)).resolves.toBe(false);
      await store.upsertNode(projectId, second);
      await store.addEdge(projectId, first.id, second.id, 'relates_to');

      await expect(
        store.search(projectId, 'remote storage'),
      ).resolves.toMatchObject([{ id: first.id }]);
      await expect(
        store.searchAcrossProjects(
          [projectId, `${projectId}-other`],
          'remote storage',
          {
            type: ['adr'],
            status: ['accepted', 'proposed'],
            tag: ['storage', 'search'],
          },
        ),
      ).resolves.toMatchObject([{ projectId, id: first.id }]);
      await expect(
        store.getFacets([projectId, `${projectId}-other`]),
      ).resolves.toEqual({
        types: ['adr'],
        statuses: ['accepted'],
        tags: ['search', 'storage'],
      });
      await expect(
        store.related(projectId, first.id, 1, ['relates_to']),
      ).resolves.toMatchObject([{ id: second.id }]);

      const updated = makeAdr(first.id, 'Changed storage decision.');
      const added = makeAdr('ADR-0003', 'Added decision.');
      await expect(
        store.applyProjectPush(
          {
            id: projectId,
            name: 'Changed project',
            type: 'changed',
          },
          [updated, added],
          [{ src: added.id, dst: 'ADR-MISSING', kind: 'relates_to' }],
        ),
      ).rejects.toThrow();
      await expect(store.get(projectId, first.id)).resolves.toMatchObject({
        title: first.title,
      });
      await expect(store.get(projectId, added.id)).resolves.toBeNull();
      await expect(store.listProjects()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: projectId,
            name: 'Postgres integration test',
          }),
        ]),
      );
      await expect(
        store.applyProjectPush(
          {
            id: projectId,
            name: 'Postgres integration test',
            type: 'library',
          },
          [first, second],
          [{ src: first.id, dst: second.id, kind: 'relates_to' }],
        ),
      ).resolves.toBe(0);

      const candidates = Array.from({ length: 10 }, (_, index) =>
        makeAdr('ADR-COLLISION', `Candidate ${index}.`),
      );
      const inserted = await Promise.all(
        candidates.map((record) => store.insertNodeIfAbsent(projectId, record)),
      );
      const winnerIndex = inserted.indexOf(true);
      expect(winnerIndex).not.toBe(-1);
      expect(inserted.filter(Boolean)).toHaveLength(1);
      await expect(
        store.get(projectId, 'ADR-COLLISION'),
      ).resolves.toMatchObject({ title: candidates[winnerIndex].title });

      await expect(
        store.get(`${projectId}-other`, first.id),
      ).resolves.toBeNull();
      await expect(store.listProjects()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: projectId, type: 'library' }),
        ]),
      );
    } finally {
      await store.close();
    }
  });

  afterAll(async () => {
    if (!connectionString) return;
    const pool = new Pool({ connectionString });
    try {
      await pool.query('DELETE FROM projects WHERE id = ANY($1::text[])', [
        [projectId, `${projectId}-other`],
      ]);
    } finally {
      await pool.end();
    }
  });
});

function makeAdr(id: string, title: string, tags: string[] = []) {
  return parseRecord(
    `---
id: ${id}
type: adr
title: ${title}
status: accepted
applies_to: ["src/**/*.ts"]
tags: ${JSON.stringify(tags)}
---

# ${id}: ${title}

## Agent Rules

- **MUST:** ${title}
`,
    `docs/decisions/adr/${id}.md`,
    'hybrid',
  );
}
