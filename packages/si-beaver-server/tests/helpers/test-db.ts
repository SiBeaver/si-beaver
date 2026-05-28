import Database from 'better-sqlite3';
import type { Sql } from '../src/storage/db.js';

const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  data TEXT NOT NULL DEFAULT '{}',
  search_vector TEXT,
  embedding TEXT,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL,
  annotation TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'user',
  operation TEXT NOT NULL,
  node_id TEXT,
  node_type TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  diff TEXT,
  context TEXT,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES ('default_project', 'default');
`;

/**
 * Replaces PostgreSQL `$1`, `$2` ... placeholders with SQLite `?` placeholders
 * and returns the modified query string along with ordered parameter values.
 */
function translateQuery(strings: TemplateStringsArray, ...values: unknown[]): { sql: string; params: unknown[] } {
  let sql = strings[0];
  const params: unknown[] = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    sql += `?${strings[i + 1]}`;
  }
  return { sql, params };
}

/**
 * Creates a SQLite-backed Sql shim that matches the postgres.js tagged template interface.
 */
export function createTestSql(dbPath: string = ':memory:'): { sql: Sql; db: Database.Database; close: () => void } {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(TEST_SCHEMA);

  // Default project for tests
  db.prepare(`INSERT OR IGNORE INTO projects (slug, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('default', 'Default Project', '', new Date().toISOString(), new Date().toISOString());

  const sql = function (strings: TemplateStringsArray, ...values: unknown[]) {
    const { sql: query, params } = translateQuery(strings, ...values);
    const isSelect = query.trim().toUpperCase().startsWith('SELECT') ||
      query.trim().toUpperCase().startsWith('WITH');
    try {
      if (isSelect) {
        return Promise.resolve(db.prepare(query).all(...params));
      } else {
        db.prepare(query).run(...params);
        return Promise.resolve([]);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  } as unknown as Sql;

  // Attach unsafe for schema init
  (sql as any).unsafe = async (q: string) => { db.exec(q); };

  const close = () => db.close();

  return { sql, db, close };
}
