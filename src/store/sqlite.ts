import Database from 'better-sqlite3';
import picomatch from 'picomatch';
import { migrate } from './migrations/001_initial.js';
import type {
  EdgeKind,
  GraphNode,
  NodeFilter,
  Project,
  SearchResult,
  Store,
} from './store.js';
import type { DecisionRecord } from '../core/schema.js';

const CURRENT_SCHEMA_VERSION = 1;
const MAX_RELATED_DEPTH = 100;

interface NodeRow {
  project_id: string;
  id: string;
  type: DecisionRecord['type'];
  title: string;
  status: string;
  applies_to: string;
  tags: string;
  rules: string;
  verify: string;
  body: string;
  path: string;
  hash: string;
  date: string | null;
  updated_at: string;
}

interface SearchRow extends NodeRow {
  snippet: string;
}

export class SQLiteStore implements Store {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);
    this.applyMigrations();
  }

  close(): void {
    this.db.close();
  }

  async upsertProject(project: Project): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, type, origin, updated_at)
         VALUES (@id, @name, @type, @origin, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           origin = excluded.origin,
           updated_at = excluded.updated_at`,
      )
      .run({ ...project, origin: project.origin ?? null, updatedAt: now() });
  }

  async upsertNode(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean> {
    const existing = this.db
      .prepare('SELECT hash, path FROM nodes WHERE project_id = ? AND id = ?')
      .get(projectId, record.id) as { hash: string; path: string } | undefined;
    if (
      existing?.hash === record.contentHash &&
      existing.path === record.path
    ) {
      return false;
    }

    const updatedAt = now();
    const node: NodeRow = {
      project_id: projectId,
      id: record.id,
      type: record.type,
      title: record.title,
      status: record.status,
      applies_to: JSON.stringify(record.appliesTo),
      tags: JSON.stringify(record.tags),
      rules: JSON.stringify(record.type === 'adr' ? record.rules : []),
      verify: JSON.stringify(record.type === 'adr' ? record.verify : []),
      body: record.body,
      path: record.path,
      hash: record.contentHash,
      date: record.date ?? null,
      updated_at: updatedAt,
    };

    const update = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO nodes (
            project_id, id, type, title, status, applies_to, tags, rules,
            verify, body, path, hash, date, updated_at
          ) VALUES (
            @project_id, @id, @type, @title, @status, @applies_to, @tags,
            @rules, @verify, @body, @path, @hash, @date, @updated_at
          )
          ON CONFLICT(project_id, id) DO UPDATE SET
            type = excluded.type,
            title = excluded.title,
            status = excluded.status,
            applies_to = excluded.applies_to,
            tags = excluded.tags,
            rules = excluded.rules,
            verify = excluded.verify,
            body = excluded.body,
            path = excluded.path,
            hash = excluded.hash,
            date = excluded.date,
            updated_at = excluded.updated_at`,
        )
        .run(node);
      this.db
        .prepare('DELETE FROM nodes_fts WHERE project_id = ? AND node_id = ?')
        .run(projectId, record.id);
      this.db
        .prepare(
          `INSERT INTO nodes_fts (project_id, node_id, title, body)
           VALUES (?, ?, ?, ?)`,
        )
        .run(projectId, record.id, record.title, record.body);
    });
    update();
    return true;
  }

  async deleteMissing(projectId: string, ids: string[]): Promise<number> {
    const keep = new Set(ids);
    const rows = this.db
      .prepare('SELECT id FROM nodes WHERE project_id = ?')
      .all(projectId) as { id: string }[];
    const staleIds = rows.map(({ id }) => id).filter((id) => !keep.has(id));
    if (staleIds.length === 0) return 0;

    const remove = this.db.transaction(() => {
      const deleteFts = this.db.prepare(
        'DELETE FROM nodes_fts WHERE project_id = ? AND node_id = ?',
      );
      const deleteNode = this.db.prepare(
        'DELETE FROM nodes WHERE project_id = ? AND id = ?',
      );
      for (const id of staleIds) {
        deleteFts.run(projectId, id);
        deleteNode.run(projectId, id);
      }
    });
    remove();
    return staleIds.length;
  }

  async deleteEdges(projectId: string): Promise<void> {
    this.db.prepare('DELETE FROM edges WHERE project_id = ?').run(projectId);
  }

  async addEdge(
    projectId: string,
    src: string,
    dst: string,
    kind: EdgeKind,
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO edges (project_id, src, dst, kind)
         VALUES (?, ?, ?, ?)`,
      )
      .run(projectId, src, dst, kind);
  }

  async get(projectId: string, id: string): Promise<GraphNode | null> {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE project_id = ? AND id = ?')
      .get(projectId, id) as NodeRow | undefined;
    return row ? mapNode(row) : null;
  }

  async list(projectId: string, filter: NodeFilter = {}): Promise<GraphNode[]> {
    const { where, params } = buildFilter(filter);
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE project_id = ?${where} ORDER BY id`)
      .all(projectId, ...params) as NodeRow[];
    return rows.map(mapNode);
  }

  async search(
    projectId: string,
    query: string,
    filter: NodeFilter = {},
  ): Promise<SearchResult[]> {
    const safeQuery = sanitizeFtsQuery(query);
    if (!safeQuery) return [];
    const { where, params } = buildFilter(filter, 'n');
    const rows = this.db
      .prepare(
        `SELECT n.*, snippet(nodes_fts, 3, '>>>', '<<<', '…', 24) AS snippet
         FROM nodes_fts
         JOIN nodes n
           ON n.project_id = nodes_fts.project_id
          AND n.id = nodes_fts.node_id
         WHERE nodes_fts MATCH ? AND n.project_id = ?${where}
         ORDER BY bm25(nodes_fts), n.id`,
      )
      .all(safeQuery, projectId, ...params) as SearchRow[];
    return rows.map((row) => ({ ...mapNode(row), snippet: row.snippet }));
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
    if (depth === 0 || (kinds && kinds.length === 0)) return [];

    const kindClause = kinds
      ? ` AND e.kind IN (${kinds.map(() => '?').join(', ')})`
      : '';
    const rows = this.db
      .prepare(
        `WITH RECURSIVE reachable(id, depth) AS (
           SELECT e.dst, 1 FROM edges e
           WHERE project_id = ? AND src = ?${kindClause}
           UNION
           SELECT e.dst, r.depth + 1
           FROM reachable r
           JOIN edges e ON e.project_id = ? AND e.src = r.id
           WHERE r.depth < ?${kindClause}
         ),
         nearest AS (
           SELECT id, MIN(depth) AS depth
           FROM reachable
           WHERE id <> ?
           GROUP BY id
         )
         SELECT n.*
         FROM nearest
         JOIN nodes n ON n.project_id = ? AND n.id = nearest.id
         ORDER BY nearest.depth, n.id`,
      )
      .all(
        projectId,
        id,
        ...(kinds ?? []),
        projectId,
        depth,
        ...(kinds ?? []),
        id,
        projectId,
      ) as NodeRow[];
    return rows.map(mapNode);
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

  private applyMigrations(): void {
    const current = this.db
      .prepare('SELECT MAX(version) AS version FROM schema_version')
      .get() as { version: number | null };
    if ((current.version ?? 0) >= CURRENT_SCHEMA_VERSION) return;

    const apply = this.db.transaction(() => {
      migrate(this.db);
      this.db
        .prepare('INSERT INTO schema_version (version) VALUES (?)')
        .run(CURRENT_SCHEMA_VERSION);
    });
    apply();
  }
}

export function sanitizeFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(' ');
}

function buildFilter(
  filter: NodeFilter,
  alias?: string,
): { where: string; params: (string | undefined)[] } {
  const prefix = alias ? `${alias}.` : '';
  const clauses: string[] = [];
  const params: (string | undefined)[] = [];
  if (filter.type) {
    clauses.push(`${prefix}type = ?`);
    params.push(filter.type);
  }
  if (filter.status) {
    clauses.push(`${prefix}status = ?`);
    params.push(filter.status);
  }
  if (filter.tag) {
    clauses.push(
      `EXISTS (
        SELECT 1 FROM json_each(${prefix}tags)
        WHERE json_each.value = ?
      )`,
    );
    params.push(filter.tag);
  }
  return {
    where: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

function mapNode(row: NodeRow): GraphNode {
  return {
    projectId: row.project_id,
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    appliesTo: JSON.parse(row.applies_to) as string[],
    tags: JSON.parse(row.tags) as string[],
    rules: JSON.parse(row.rules) as GraphNode['rules'],
    verify: JSON.parse(row.verify) as GraphNode['verify'],
    body: row.body,
    path: row.path,
    contentHash: row.hash,
    date: row.date ?? undefined,
    updatedAt: row.updated_at,
  };
}

function now(): string {
  return new Date().toISOString();
}
