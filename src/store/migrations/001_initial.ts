import type Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      origin TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE nodes (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('adr', 'sdr')),
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      applies_to TEXT NOT NULL,
      tags TEXT NOT NULL,
      rules TEXT NOT NULL,
      verify TEXT NOT NULL,
      body TEXT NOT NULL,
      path TEXT NOT NULL,
      hash TEXT NOT NULL,
      date TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, id)
    );

    CREATE INDEX nodes_project_type_status
      ON nodes(project_id, type, status);

    CREATE TABLE edges (
      project_id TEXT NOT NULL,
      src TEXT NOT NULL,
      dst TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (
        kind IN (
          'supersedes',
          'relates_to',
          'derived_from',
          'promoted_to',
          'conflicts_with'
        )
      ),
      PRIMARY KEY (project_id, src, dst, kind),
      FOREIGN KEY (project_id, src) REFERENCES nodes(project_id, id)
        ON DELETE CASCADE,
      FOREIGN KEY (project_id, dst) REFERENCES nodes(project_id, id)
        ON DELETE CASCADE
    );

    CREATE INDEX edges_project_source ON edges(project_id, src, kind);

    CREATE VIRTUAL TABLE nodes_fts USING fts5(
      project_id UNINDEXED,
      node_id UNINDEXED,
      title,
      body,
      tokenize = 'unicode61'
    );
  `);
}
