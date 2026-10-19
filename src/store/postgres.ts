import { Pool, type PoolClient } from 'pg';
import picomatch from 'picomatch';
import type { DecisionRecord } from '../core/schema.js';
import type {
  EdgeKind,
  GraphEdge,
  GraphNode,
  NodeFilter,
  Project,
  RecordFacets,
  SearchResult,
  Store,
} from './store.js';

const MAX_RELATED_DEPTH = 100;

interface NodeRow {
  project_id: string;
  id: string;
  type: DecisionRecord['type'];
  title: string;
  status: string;
  applies_to: string[];
  tags: string[];
  rules: GraphNode['rules'];
  verify: GraphNode['verify'];
  body: string;
  path: string;
  hash: string;
  date: string | null;
  updated_at: Date | string;
}

export class PostgresStore implements Store {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.ready = this.migrate();
  }

  async close(): Promise<void> {
    try {
      await this.ready;
    } finally {
      await this.pool.end();
    }
  }

  async upsertProject(project: Project): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO projects (id, name, type, origin, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         origin = EXCLUDED.origin,
         updated_at = NOW()`,
      [project.id, project.name, project.type, project.origin ?? null],
    );
  }

  async listProjects(): Promise<Project[]> {
    await this.ready;
    const result = await this.pool.query<{
      id: string;
      name: string;
      type: string;
      origin: string | null;
    }>('SELECT id, name, type, origin FROM projects ORDER BY id');
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      origin: row.origin ?? undefined,
    }));
  }

  async upsertNode(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean> {
    await this.ready;
    const client = await this.pool.connect();
    try {
      return await this.writeNodeWithClient(client, projectId, record, false);
    } finally {
      client.release();
    }
  }

  async insertNodeIfAbsent(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean> {
    await this.ready;
    const client = await this.pool.connect();
    try {
      return await this.writeNodeWithClient(client, projectId, record, true);
    } finally {
      client.release();
    }
  }

  async applyProjectPush(
    project: Project,
    records: DecisionRecord[],
    edges: GraphEdge[],
  ): Promise<number> {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.upsertProjectWithClient(client, project);
      let changed = 0;
      for (const record of records) {
        if (await this.writeNodeWithClient(client, project.id, record, false)) {
          changed += 1;
        }
      }
      await client.query('DELETE FROM edges WHERE project_id = $1', [
        project.id,
      ]);
      for (const edge of edges) {
        await client.query(
          `INSERT INTO edges (project_id, src, dst, kind)
           VALUES ($1, $2, $3, $4)`,
          [project.id, edge.src, edge.dst, edge.kind],
        );
      }
      await client.query('COMMIT');
      return changed;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteMissing(projectId: string, ids: string[]): Promise<number> {
    await this.ready;
    const result = await this.pool.query(
      `DELETE FROM nodes
       WHERE project_id = $1
         AND NOT (id = ANY($2::text[]))`,
      [projectId, ids],
    );
    return result.rowCount ?? 0;
  }

  async deleteEdges(
    projectId: string,
    sources?: string[],
    kind?: EdgeKind,
  ): Promise<void> {
    await this.ready;
    if (sources?.length === 0) return;
    const values: (string | string[])[] = [projectId];
    let query = 'DELETE FROM edges WHERE project_id = $1';
    if (kind) {
      values.push(kind);
      query += ` AND kind = $${values.length}`;
    }
    if (sources) {
      values.push(sources);
      query += ` AND src = ANY($${values.length}::text[])`;
    }
    await this.pool.query(query, values);
  }

  async addEdge(
    projectId: string,
    src: string,
    dst: string,
    kind: EdgeKind,
  ): Promise<void> {
    await this.ready;
    await this.pool.query(
      `INSERT INTO edges (project_id, src, dst, kind)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [projectId, src, dst, kind],
    );
  }

  async listEdges(projectId: string): Promise<GraphEdge[]> {
    await this.ready;
    const result = await this.pool.query<GraphEdge>(
      `SELECT src, dst, kind
       FROM edges
       WHERE project_id = $1
       ORDER BY src, dst, kind`,
      [projectId],
    );
    return result.rows;
  }

  async get(projectId: string, id: string): Promise<GraphNode | null> {
    await this.ready;
    const result = await this.pool.query<NodeRow>(
      'SELECT * FROM nodes WHERE project_id = $1 AND id = $2',
      [projectId, id],
    );
    return result.rows[0] ? mapNode(result.rows[0]) : null;
  }

  async list(projectId: string, filter: NodeFilter = {}): Promise<GraphNode[]> {
    await this.ready;
    const { clause, values } = buildFilter(filter, 2);
    const result = await this.pool.query<NodeRow>(
      `SELECT * FROM nodes WHERE project_id = $1${clause} ORDER BY id`,
      [projectId, ...values],
    );
    return result.rows.map(mapNode);
  }

  async getFacets(projectIds: string[]): Promise<RecordFacets> {
    if (projectIds.length === 0) {
      return { types: [], statuses: [], tags: [] };
    }
    await this.ready;
    const [types, statuses, tags] = await Promise.all([
      this.pool.query<{ type: DecisionRecord['type'] }>(
        `SELECT DISTINCT type FROM nodes
         WHERE project_id = ANY($1::text[])
         ORDER BY type`,
        [projectIds],
      ),
      this.pool.query<{ status: string }>(
        `SELECT DISTINCT status FROM nodes
         WHERE project_id = ANY($1::text[])
         ORDER BY status`,
        [projectIds],
      ),
      this.pool.query<{ tag: string }>(
        `SELECT DISTINCT tag.value AS tag
         FROM nodes
         CROSS JOIN LATERAL jsonb_array_elements_text(nodes.tags) AS tag(value)
         WHERE nodes.project_id = ANY($1::text[])
         ORDER BY tag.value`,
        [projectIds],
      ),
    ]);
    return {
      types: types.rows.map((row) => row.type),
      statuses: statuses.rows.map((row) => row.status),
      tags: tags.rows.map((row) => row.tag),
    };
  }

  async search(
    projectId: string,
    query: string,
    filter: NodeFilter = {},
  ): Promise<SearchResult[]> {
    return this.searchAcrossProjects([projectId], query, filter);
  }

  async searchAcrossProjects(
    projectIds: string[],
    query: string,
    filter: NodeFilter = {},
  ): Promise<SearchResult[]> {
    if (projectIds.length === 0) return [];
    await this.ready;
    if (!query.trim()) return [];
    const { clause, values } = buildFilter(filter, 3, 'n');
    const result = await this.pool.query<NodeRow & { snippet: string }>(
      `SELECT n.*,
              ts_headline('english', n.body, plainto_tsquery('english', $1),
                'StartSel=>>>, StopSel=<<<, MaxFragments=2') AS snippet
       FROM nodes n
       WHERE n.project_id = ANY($2::text[])
         AND n.search_vector @@ plainto_tsquery('english', $1)${clause}
       ORDER BY ts_rank(n.search_vector, plainto_tsquery('english', $1)) DESC,
                n.title, n.project_id, n.id`,
      [query, projectIds, ...values],
    );
    return result.rows.map((row) => ({
      ...mapNode(row),
      snippet: row.snippet,
    }));
  }

  async related(
    projectId: string,
    id: string,
    depth = 1,
    kinds?: EdgeKind[],
  ): Promise<GraphNode[]> {
    if (!Number.isInteger(depth) || depth < 0 || depth > MAX_RELATED_DEPTH) {
      throw new RangeError(
        `depth must be an integer between 0 and ${MAX_RELATED_DEPTH}`,
      );
    }
    if (depth === 0 || kinds?.length === 0) return [];
    await this.ready;
    const result = await this.pool.query<NodeRow>(
      `WITH RECURSIVE reachable(id, depth) AS (
         SELECT dst, 1
         FROM edges
         WHERE project_id = $1 AND src = $2
           AND ($3::text[] IS NULL OR kind = ANY($3::text[]))
         UNION
         SELECT e.dst, r.depth + 1
         FROM reachable r
         JOIN edges e ON e.project_id = $1 AND e.src = r.id
         WHERE r.depth < $4
           AND ($3::text[] IS NULL OR e.kind = ANY($3::text[]))
       ),
       nearest AS (
         SELECT id, MIN(depth) AS depth
         FROM reachable
         WHERE id <> $2
         GROUP BY id
       )
       SELECT n.*
       FROM nearest
       JOIN nodes n ON n.project_id = $1 AND n.id = nearest.id
       ORDER BY nearest.depth, n.id`,
      [projectId, id, kinds?.length ? kinds : null, depth],
    );
    return result.rows.map(mapNode);
  }

  async byGlobMatch(projectId: string, files: string[]): Promise<GraphNode[]> {
    if (files.length === 0) return [];
    const nodes = await this.list(projectId);
    return nodes.filter((node) =>
      node.appliesTo.some((pattern) =>
        files.some((file) => picomatch.isMatch(file, pattern)),
      ),
    );
  }

  private async upsertProjectWithClient(
    client: PoolClient,
    project: Project,
  ): Promise<void> {
    await client.query(
      `INSERT INTO projects (id, name, type, origin, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         origin = EXCLUDED.origin,
         updated_at = NOW()`,
      [project.id, project.name, project.type, project.origin ?? null],
    );
  }

  private async writeNodeWithClient(
    client: PoolClient,
    projectId: string,
    record: DecisionRecord,
    insertOnly: boolean,
  ): Promise<boolean> {
    const conflictAction = insertOnly
      ? 'ON CONFLICT (project_id, id) DO NOTHING'
      : `ON CONFLICT (project_id, id) DO UPDATE SET
           type = EXCLUDED.type,
           title = EXCLUDED.title,
           status = EXCLUDED.status,
           applies_to = EXCLUDED.applies_to,
           tags = EXCLUDED.tags,
           rules = EXCLUDED.rules,
           verify = EXCLUDED.verify,
           body = EXCLUDED.body,
           path = EXCLUDED.path,
           hash = EXCLUDED.hash,
           date = EXCLUDED.date,
           updated_at = NOW(),
           search_vector = EXCLUDED.search_vector
         WHERE nodes.hash IS DISTINCT FROM EXCLUDED.hash
            OR nodes.path IS DISTINCT FROM EXCLUDED.path`;
    const result = await client.query<{ id: string }>(
      `INSERT INTO nodes (
         project_id, id, type, title, status, applies_to, tags, rules,
         verify, body, path, hash, date, updated_at, search_vector
       ) VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb,
         $9::jsonb, $10, $11, $12, $13, NOW(),
         to_tsvector('english', $4 || ' ' || $10)
       )
       ${conflictAction}
       RETURNING id`,
      [
        projectId,
        record.id,
        record.type,
        record.title,
        record.status,
        JSON.stringify(record.appliesTo),
        JSON.stringify(record.tags),
        JSON.stringify(record.type === 'adr' ? record.rules : []),
        JSON.stringify(record.type === 'adr' ? record.verify : []),
        record.body,
        record.path,
        record.contentHash,
        record.date ?? null,
      ],
    );
    return result.rows.length > 0;
  }

  private async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          origin TEXT,
          updated_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nodes (
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('adr', 'sdr')),
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          applies_to JSONB NOT NULL,
          tags JSONB NOT NULL,
          rules JSONB NOT NULL,
          verify JSONB NOT NULL,
          body TEXT NOT NULL,
          path TEXT NOT NULL,
          hash TEXT NOT NULL,
          date TEXT,
          updated_at TIMESTAMPTZ NOT NULL,
          search_vector TSVECTOR NOT NULL,
          PRIMARY KEY (project_id, id)
        );
        CREATE INDEX IF NOT EXISTS nodes_project_type_status
          ON nodes(project_id, type, status);
        CREATE INDEX IF NOT EXISTS nodes_search_vector
          ON nodes USING GIN(search_vector);
        CREATE TABLE IF NOT EXISTS edges (
          project_id TEXT NOT NULL,
          src TEXT NOT NULL,
          dst TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (
            kind IN (
              'supersedes', 'relates_to', 'derived_from',
              'promoted_to', 'conflicts_with'
            )
          ),
          PRIMARY KEY (project_id, src, dst, kind),
          FOREIGN KEY (project_id, src)
            REFERENCES nodes(project_id, id) ON DELETE CASCADE,
          FOREIGN KEY (project_id, dst)
            REFERENCES nodes(project_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS edges_project_source
          ON edges(project_id, src, kind);
        INSERT INTO schema_version(version)
          VALUES (1) ON CONFLICT (version) DO NOTHING;
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function buildFilter(
  filter: NodeFilter,
  firstParameter: number,
  alias = '',
): { clause: string; values: (string | string[])[] } {
  const clauses: string[] = [];
  const values: (string | string[])[] = [];
  const column = (name: string) => (alias ? `${alias}.${name}` : name);
  const types = filterValues(filter.type);
  const statuses = filterValues(filter.status);
  const tags = filterValues(filter.tag);
  if (types.length > 0) {
    values.push(types);
    clauses.push(
      `${column('type')} = ANY($${firstParameter + values.length - 1}::text[])`,
    );
  }
  if (statuses.length > 0) {
    values.push(statuses);
    clauses.push(
      `${column('status')} = ANY($${firstParameter + values.length - 1}::text[])`,
    );
  }
  if (tags.length > 0) {
    values.push(tags);
    clauses.push(
      `${column('tags')} ?| $${firstParameter + values.length - 1}::text[]`,
    );
  }
  return {
    clause: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    values,
  };
}

function filterValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function mapNode(row: NodeRow): GraphNode {
  return {
    projectId: row.project_id,
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    appliesTo: row.applies_to,
    tags: row.tags,
    rules: row.rules,
    verify: row.verify,
    body: row.body,
    path: row.path,
    contentHash: row.hash,
    date: row.date ?? undefined,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}
