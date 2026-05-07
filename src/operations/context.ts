import type BetterSqlite3 from 'better-sqlite3';
import { NodeStore, EdgeStore, EventStore } from '../storage/stores.js';
import { EventEmitter } from '../core/events/emitter.js';

/**
 * 操作上下文 — 所有语义操作共享的依赖
 */
export class OperationContext {
  readonly nodes: NodeStore;
  readonly edges: EdgeStore;
  readonly events: EventEmitter;
  readonly eventStore: EventStore;

  constructor(db: BetterSqlite3.Database) {
    const nodeStore = new NodeStore(db);
    const edgeStore = new EdgeStore(db);
    const eventStore = new EventStore(db);

    this.nodes = nodeStore;
    this.edges = edgeStore;
    this.eventStore = eventStore;
    this.events = new EventEmitter(eventStore);
  }
}
