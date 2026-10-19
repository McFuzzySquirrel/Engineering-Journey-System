import Database from 'better-sqlite3';
import picomatch from 'picomatch';
import { migrate } from './migrations/001_initial.js';
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
    this.upsertProjectSync(project);
  }

  private upsertProjectSync(project: Project): void {
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

  private updateFtsRecord(projectId: string, record: DecisionRecord): void {
    this.db
      .prepare('DELETE FROM nodes_fts WHERE project_id = ? AND node_id = ?')
      .run(projectId, record.id);
    this.db
      .prepare(
        `INSERT INTO nodes_fts (project_id, node_id, title, body)
         VALUES (?, ?, ?, ?)`,
      )
      .run(projectId, record.id, record.title, record.body);
  }

  async listProjects(): Promise<Project[]> {
    return this.db
      .prepare('SELECT id, name, type, origin FROM projects ORDER BY id')
      .all()
      .map((row) => {
        const project = row as {
          id: string;
          name: string;
          type: string;
          origin: string | null;
        };
        return {
          id: project.id,
          name: project.name,
          type: project.type,
          origin: project.origin ?? undefined,
        };
      });
  }

  async upsertNode(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean> {
    return this.upsertNodeSync(projectId, record);
  }

  private upsertNodeSync(projectId: string, record: DecisionRecord): boolean {
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
      this.updateFtsRecord(projectId, record);
    });
    update();
    return true;
  }

  async insertNodeIfAbsent(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean> {
    const node = toNodeRow(projectId, record);
    return this.db.transaction(() => {
      const inserted = this.db
        .prepare(
          `INSERT INTO nodes (
            project_id, id, type, title, status, applies_to, tags, rules,
            verify, body, path, hash, date, updated_at
          ) VALUES (
            @project_id, @id, @type, @title, @status, @applies_to, @tags,
            @rules, @verify, @body, @path, @hash, @date, @updated_at
          )
          ON CONFLICT(project_id, id) DO NOTHING`,
        )
        .run(node);
      if (inserted.changes === 0) return false;
      this.updateFtsRecord(projectId, record);
      return true;
    })();
  }

  async applyProjectPush(
    project: Project,
    records: DecisionRecord[],
    edges: GraphEdge[],
  ): Promise<number> {
    return this.db.transaction(() => {
      this.upsertProjectSync(project);
      let changed = 0;
      for (const record of records) {
        if (this.upsertNodeSync(project.id, record)) changed += 1;
      }
      this.db.prepare('DELETE FROM edges WHERE project_id = ?').run(project.id);
      const insertEdge = this.db.prepare(
        `INSERT INTO edges (project_id, src, dst, kind)
         VALUES (?, ?, ?, ?)`,
      );
      for (const edge of edges) {
        insertEdge.run(project.id, edge.src, edge.dst, edge.kind);
      }
      return changed;
    })();
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

  async deleteEdges(
    projectId: string,
    sources?: string[],
    kind?: EdgeKind,
  ): Promise<void> {
    if (sources === undefined && kind === undefined) {
      this.db.prepare('DELETE FROM edges WHERE project_id = ?').run(projectId);
      return;
    }
    if (sources?.length === 0) return;
    const deleteSources = (batch?: string[]) =>
      this.db
        .prepare(
          `DELETE FROM edges WHERE project_id = ?${kind ? ' AND kind = ?' : ''}${batch ? ` AND src IN (${batch.map(() => '?').join(', ')})` : ''}`,
        )
        .run(projectId, ...(kind ? [kind] : []), ...(batch ?? []));
    if (sources === undefined) {
      deleteSources();
    } else {
      for (let index = 0; index < sources.length; index += 900) {
        deleteSources(sources.slice(index, index + 900));
      }
    }
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

  async listEdges(projectId: string): Promise<GraphEdge[]> {
    return this.db
      .prepare(
        'SELECT src, dst, kind FROM edges WHERE project_id = ? ORDER BY src, dst, kind',
      )
      .all(projectId) as GraphEdge[];
  }

  async list(projectId: string, filter: NodeFilter = {}): Promise<GraphNode[]> {
    const { where, params } = buildFilter(filter);
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE project_id = ?${where} ORDER BY id`)
      .all(projectId, ...params) as NodeRow[];
    return rows.map(mapNode);
  }

  async getFacets(projectIds: string[]): Promise<RecordFacets> {
    if (projectIds.length === 0) {
      return { types: [], statuses: [], tags: [] };
    }
    const placeholders = projectIds.map(() => '?').join(', ');
    const types = this.db
      .prepare(
        `SELECT DISTINCT type FROM nodes
         WHERE project_id IN (${placeholders})
         ORDER BY type`,
      )
      .all(...projectIds) as { type: DecisionRecord['type'] }[];
    const statuses = this.db
      .prepare(
        `SELECT DISTINCT status FROM nodes
         WHERE project_id IN (${placeholders})
         ORDER BY status`,
      )
      .all(...projectIds) as { status: string }[];
    const tags = this.db
      .prepare(
        `SELECT DISTINCT json_each.value AS tag
         FROM nodes, json_each(nodes.tags)
         WHERE nodes.project_id IN (${placeholders})
         ORDER BY tag`,
      )
      .all(...projectIds) as { tag: string }[];
    return {
      types: types.map((row) => row.type),
      statuses: statuses.map((row) => row.status),
      tags: tags.map((row) => row.tag),
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
    const safeQuery = sanitizeFtsQuery(query);
    if (!safeQuery) return [];
    const { where, params } = buildFilter(filter, 'n');
    const placeholders = projectIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT n.*, snippet(nodes_fts, 3, '>>>', '<<<', '…', 24) AS snippet
         FROM nodes_fts
         JOIN nodes n
           ON n.project_id = nodes_fts.project_id
          AND n.id = nodes_fts.node_id
         WHERE nodes_fts MATCH ? AND n.project_id IN (${placeholders})${where}
         ORDER BY bm25(nodes_fts), n.title COLLATE NOCASE, n.project_id, n.id`,
      )
      .all(safeQuery, ...projectIds, ...params) as SearchRow[];
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
): { where: string; params: string[] } {
  const prefix = alias ? `${alias}.` : '';
  const clauses: string[] = [];
  const params: string[] = [];
  const types = filterValues(filter.type);
  const statuses = filterValues(filter.status);
  const tags = filterValues(filter.tag);
  if (types.length > 0) {
    clauses.push(`${prefix}type IN (${types.map(() => '?').join(', ')})`);
    params.push(...types);
  }
  if (statuses.length > 0) {
    clauses.push(`${prefix}status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (tags.length > 0) {
    clauses.push(
      `EXISTS (
        SELECT 1 FROM json_each(${prefix}tags)
        WHERE json_each.value IN (${tags.map(() => '?').join(', ')})
      )`,
    );
    params.push(...tags);
  }
  return {
    where: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
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

function toNodeRow(projectId: string, record: DecisionRecord): NodeRow {
  return {
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
    updated_at: now(),
  };
}

function now(): string {
  return new Date().toISOString();
}
