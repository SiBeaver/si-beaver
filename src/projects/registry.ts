import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ProjectMeta, CreateProjectInput, UpdateProjectInput } from './types.js';

const REGISTRY_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES ('default_project', 'default');
`;

export class Registry {
  private db: Database.Database;
  private stmts: {
    insert: Database.Statement;
    list: Database.Statement;
    get: Database.Statement;
    update: Database.Statement;
    archive: Database.Statement;
    getConfig: Database.Statement;
    setConfig: Database.Statement;
  };

  constructor(registryPath: string) {
    mkdirSync(dirname(registryPath), { recursive: true });
    this.db = new Database(registryPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(REGISTRY_SCHEMA);

    this.stmts = {
      insert: this.db.prepare(
        'INSERT INTO projects (slug, name, description, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)'
      ),
      list: this.db.prepare(
        'SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC'
      ),
      get: this.db.prepare('SELECT * FROM projects WHERE slug = ?'),
      update: this.db.prepare(
        'UPDATE projects SET name = ?, description = ?, updated_at = ?, metadata = ? WHERE slug = ?'
      ),
      archive: this.db.prepare(
        'UPDATE projects SET archived = 1, updated_at = ? WHERE slug = ?'
      ),
      getConfig: this.db.prepare('SELECT value FROM config WHERE key = ?'),
      setConfig: this.db.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
      ),
    };
  }

  insertProject(input: CreateProjectInput): ProjectMeta {
    const now = new Date().toISOString();
    this.stmts.insert.run(
      input.slug,
      input.name,
      input.description ?? '',
      now,
      now,
      JSON.stringify(input.metadata ?? {}),
    );
    return {
      slug: input.slug,
      name: input.name,
      description: input.description ?? '',
      createdAt: now,
      updatedAt: now,
      archived: false,
      metadata: input.metadata ?? {},
    };
  }

  listProjects(): ProjectMeta[] {
    const rows = this.stmts.list.all() as any[];
    return rows.map(rowToMeta);
  }

  getProject(slug: string): ProjectMeta | null {
    const row = this.stmts.get.get(slug) as any;
    return row ? rowToMeta(row) : null;
  }

  updateProject(slug: string, patch: UpdateProjectInput): ProjectMeta | null {
    const existing = this.getProject(slug);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated = {
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      metadata: patch.metadata ?? existing.metadata,
    };
    this.stmts.update.run(
      updated.name,
      updated.description,
      now,
      JSON.stringify(updated.metadata),
      slug,
    );
    return { ...existing, ...updated, updatedAt: now };
  }

  archiveProject(slug: string): void {
    const now = new Date().toISOString();
    this.stmts.archive.run(now, slug);
  }

  getConfig(key: string): string | null {
    const row = this.stmts.getConfig.get(key) as any;
    return row?.value ?? null;
  }

  setConfig(key: string, value: string): void {
    this.stmts.setConfig.run(key, value);
  }

  close(): void {
    this.db.close();
  }
}

function rowToMeta(row: any): ProjectMeta {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived === 1,
    metadata: JSON.parse(row.metadata || '{}'),
  };
}
