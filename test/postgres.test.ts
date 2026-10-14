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
      const first = makeAdr('ADR-0001', 'Use Postgres for remote storage.');
      const second = makeAdr('ADR-0002', 'Keep records searchable.');
      await expect(store.upsertNode(projectId, first)).resolves.toBe(true);
      await expect(store.upsertNode(projectId, first)).resolves.toBe(false);
      await store.upsertNode(projectId, second);
      await store.addEdge(projectId, first.id, second.id, 'relates_to');

      await expect(
        store.search(projectId, 'remote storage'),
      ).resolves.toMatchObject([{ id: first.id }]);
      await expect(
        store.related(projectId, first.id, 1, ['relates_to']),
      ).resolves.toMatchObject([{ id: second.id }]);
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

function makeAdr(id: string, title: string) {
  return parseRecord(
    `---
id: ${id}
type: adr
title: ${title}
status: accepted
applies_to: ["src/**/*.ts"]
---

# ${id}: ${title}

## Agent Rules

- **MUST:** ${title}
`,
    `docs/decisions/adr/${id}.md`,
    'hybrid',
  );
}
