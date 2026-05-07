import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// ============================================================
// 数据库初始化 + 迁移
// ============================================================

const SCHEMA_SQL = `
-- 节点表：所有类型的认知节点统一存储
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',        -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',    -- JSON object
  data TEXT NOT NULL DEFAULT '{}'         -- 各类型特有字段，JSON object
);

-- 全文搜索索引
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  title,
  description,
  content=nodes,
  content_rowid=rowid
);

-- FTS 同步触发器
CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(rowid, title, description)
  VALUES (new.rowid, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, old.description);
  INSERT INTO nodes_fts(rowid, title, description)
  VALUES (new.rowid, new.title, new.description);
END;

-- 边表：节点间的语义关系
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL,
  annotation TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
);

-- 事件表：不可变的工程记忆
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'user',
  operation TEXT NOT NULL,
  node_id TEXT,
  node_type TEXT,
  payload TEXT NOT NULL DEFAULT '{}',     -- JSON
  diff TEXT,                               -- JSON array or null
  context TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_type_status ON nodes(type, status);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);
CREATE INDEX IF NOT EXISTS idx_edges_source_relation ON edges(source_id, relation);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_node_id ON events(node_id);
CREATE INDEX IF NOT EXISTS idx_events_node_type ON events(node_type);
`;

export function openDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  // 性能优化
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // 执行 schema
  db.exec(SCHEMA_SQL);

  return db;
}
