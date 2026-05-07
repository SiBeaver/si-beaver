import type BetterSqlite3 from 'better-sqlite3';
import type { CognitiveNode, NodeType } from '../core/nodes/types.js';
import type { Edge } from '../core/edges/types.js';
import type { EventRecord } from '../core/events/types.js';

type Statement = BetterSqlite3.Statement;

// ============================================================
// 节点存储
// ============================================================

// 从 CognitiveNode 拆分为数据库行格式
function nodeToRow(node: CognitiveNode) {
  const { id, type, title, description, status, tags, created_at, updated_at, metadata, ...data } = node;
  return {
    id,
    type,
    title,
    description,
    status,
    tags: JSON.stringify(tags),
    created_at,
    updated_at,
    metadata: JSON.stringify(metadata),
    data: JSON.stringify(data),
  };
}

// 从数据库行格式还原为 CognitiveNode
function rowToNode(row: any): CognitiveNode {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    tags: JSON.parse(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    metadata: JSON.parse(row.metadata),
  } as CognitiveNode;
}

export class NodeStore {
  private insertStmt: Statement;
  private updateStmt: Statement;
  private getByIdStmt: Statement;
  private getByTypeStmt: Statement;
  private getByTypeStatusStmt: Statement;
  private deleteStmt: Statement;
  private searchStmt: Statement;

  constructor(private db: BetterSqlite3.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO nodes (id, type, title, description, status, tags, created_at, updated_at, metadata, data)
      VALUES (@id, @type, @title, @description, @status, @tags, @created_at, @updated_at, @metadata, @data)
    `);

    this.updateStmt = db.prepare(`
      UPDATE nodes SET title=@title, description=@description, status=@status,
        tags=@tags, updated_at=@updated_at, metadata=@metadata, data=@data
      WHERE id=@id
    `);

    this.getByIdStmt = db.prepare('SELECT * FROM nodes WHERE id = ?');
    this.getByTypeStmt = db.prepare('SELECT * FROM nodes WHERE type = ?');
    this.getByTypeStatusStmt = db.prepare('SELECT * FROM nodes WHERE type = ? AND status = ?');
    this.deleteStmt = db.prepare('DELETE FROM nodes WHERE id = ?');
    this.searchStmt = db.prepare(`
      SELECT nodes.* FROM nodes_fts
      JOIN nodes ON nodes.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ?
      ORDER BY rank
    `);
  }

  insert(node: CognitiveNode): void {
    this.insertStmt.run(nodeToRow(node));
  }

  update(node: CognitiveNode): void {
    const { id, title, description, status, tags, updated_at, metadata, type, created_at, ...data } = node;
    this.updateStmt.run({
      id,
      title,
      description,
      status,
      tags: JSON.stringify(tags),
      updated_at,
      metadata: JSON.stringify(metadata),
      data: JSON.stringify(data),
    });
  }

  getById(id: string): CognitiveNode | null {
    const row = this.getByIdStmt.get(id);
    return row ? rowToNode(row) : null;
  }

  getByType(type: NodeType): CognitiveNode[] {
    const rows = this.getByTypeStmt.all(type) as any[];
    return rows.map(rowToNode);
  }

  getByTypeAndStatus(type: NodeType, status: string): CognitiveNode[] {
    const rows = this.getByTypeStatusStmt.all(type, status) as any[];
    return rows.map(rowToNode);
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }

  search(query: string): CognitiveNode[] {
    const rows = this.searchStmt.all(query) as any[];
    return rows.map(rowToNode);
  }
}

// ============================================================
// 边存储
// ============================================================

export class EdgeStore {
  private insertStmt: Statement;
  private getBySourceStmt: Statement;
  private getByTargetStmt: Statement;
  private getByNodeStmt: Statement;
  private deleteStmt: Statement;

  constructor(private db: BetterSqlite3.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO edges (id, source_id, target_id, relation, weight, annotation, created_at)
      VALUES (@id, @source_id, @target_id, @relation, @weight, @annotation, @created_at)
    `);

    this.getBySourceStmt = db.prepare('SELECT * FROM edges WHERE source_id = ?');
    this.getByTargetStmt = db.prepare('SELECT * FROM edges WHERE target_id = ?');
    this.getByNodeStmt = db.prepare('SELECT * FROM edges WHERE source_id = ? OR target_id = ?');
    this.deleteStmt = db.prepare('DELETE FROM edges WHERE id = ?');
  }

  insert(edge: Edge): void {
    this.insertStmt.run({
      id: edge.id,
      source_id: edge.source_id,
      target_id: edge.target_id,
      relation: edge.relation,
      weight: edge.weight,
      annotation: edge.annotation,
      created_at: edge.created_at,
    });
  }

  getBySource(sourceId: string): Edge[] {
    return this.getBySourceStmt.all(sourceId) as Edge[];
  }

  getByTarget(targetId: string): Edge[] {
    return this.getByTargetStmt.all(targetId) as Edge[];
  }

  getByNode(nodeId: string): Edge[] {
    return this.getByNodeStmt.all(nodeId, nodeId) as Edge[];
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }
}

// ============================================================
// 事件存储
// ============================================================

export class EventStore {
  private insertStmt: Statement;
  private getByNodeStmt: Statement;
  private getRecentStmt: Statement;
  private getSinceStmt: Statement;

  constructor(private db: BetterSqlite3.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO events (id, timestamp, event_type, actor, operation, node_id, node_type, payload, diff, context)
      VALUES (@id, @timestamp, @event_type, @actor, @operation, @node_id, @node_type, @payload, @diff, @context)
    `);

    this.getByNodeStmt = db.prepare(
      'SELECT * FROM events WHERE node_id = ? ORDER BY timestamp ASC'
    );

    this.getRecentStmt = db.prepare(
      'SELECT * FROM events ORDER BY timestamp DESC LIMIT ?'
    );

    this.getSinceStmt = db.prepare(
      'SELECT * FROM events WHERE timestamp >= ? ORDER BY timestamp ASC'
    );
  }

  insert(event: EventRecord): void {
    this.insertStmt.run({
      id: event.id,
      timestamp: event.timestamp,
      event_type: event.event_type,
      actor: event.actor,
      operation: event.operation,
      node_id: event.node_id,
      node_type: event.node_type,
      payload: JSON.stringify(event.payload),
      diff: event.diff ? JSON.stringify(event.diff) : null,
      context: event.context,
    });
  }

  getByNode(nodeId: string): EventRecord[] {
    const rows = this.getByNodeStmt.all(nodeId) as any[];
    return rows.map(this.rowToEvent);
  }

  getRecent(limit: number = 20): EventRecord[] {
    const rows = this.getRecentStmt.all(limit) as any[];
    return rows.map(this.rowToEvent);
  }

  getSince(since: string): EventRecord[] {
    const rows = this.getSinceStmt.all(since) as any[];
    return rows.map(this.rowToEvent);
  }

  private rowToEvent(row: any): EventRecord {
    return {
      ...row,
      payload: JSON.parse(row.payload),
      diff: row.diff ? JSON.parse(row.diff) : null,
    };
  }
}
