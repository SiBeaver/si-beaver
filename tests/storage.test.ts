import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/storage/db.js';
import { NodeStore, EdgeStore, EventStore } from '../src/storage/stores.js';
import { ulid } from 'ulidx';
import type { GoalNode } from '../src/core/nodes/types.js';
import type { Edge } from '../src/core/edges/types.js';
import type { EventRecord } from '../src/core/events/types.js';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';

const TEST_DB = '/tmp/si-beaver-test.db';

describe('Storage Layer', () => {
  let db: Database.Database;
  let nodes: NodeStore;
  let edges: EdgeStore;
  let events: EventStore;

  beforeEach(() => {
    try { unlinkSync(TEST_DB); } catch {}
    db = openDatabase(TEST_DB);
    nodes = new NodeStore(db);
    edges = new EdgeStore(db);
    events = new EventStore(db);
  });

  afterEach(() => {
    db.close();
    try { unlinkSync(TEST_DB); } catch {}
  });

  describe('NodeStore', () => {
    it('应该能插入和读取 Goal 节点', () => {
      const now = new Date().toISOString();
      const goal: GoalNode = {
        id: ulid(),
        type: 'goal',
        title: '完成 si-beaver MVP',
        description: '构建 AI 原生项目认知平台的最小可用版本',
        status: 'active',
        tags: ['mvp', 'core'],
        created_at: now,
        updated_at: now,
        metadata: {},
        horizon: 'medium',
        success_criteria: ['MCP 服务器可连接', 'AI 工具可读写图谱'],
        priority: 'high',
      };

      nodes.insert(goal);
      const retrieved = nodes.getById(goal.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('完成 si-beaver MVP');
      expect(retrieved!.type).toBe('goal');
      expect((retrieved as GoalNode).horizon).toBe('medium');
      expect((retrieved as GoalNode).success_criteria).toEqual(['MCP 服务器可连接', 'AI 工具可读写图谱']);
    });

    it('应该支持按类型查询', () => {
      const now = new Date().toISOString();
      nodes.insert({
        id: ulid(), type: 'goal', title: 'Goal 1', description: '', status: 'active',
        tags: [], created_at: now, updated_at: now, metadata: {},
        horizon: 'short', success_criteria: [], priority: 'medium',
      });
      nodes.insert({
        id: ulid(), type: 'task', title: 'Task 1', description: '', status: 'proposed',
        tags: [], created_at: now, updated_at: now, metadata: {},
        effort: 'small', priority: 'medium', acceptance_criteria: [],
      });

      const goals = nodes.getByType('goal');
      expect(goals).toHaveLength(1);
      expect(goals[0].title).toBe('Goal 1');
    });

    it('应该支持全文搜索', () => {
      const now = new Date().toISOString();
      nodes.insert({
        id: ulid(), type: 'exploration', title: '研究 WebSocket 重连机制',
        description: '探索 actor model 在 WebSocket 场景的应用',
        status: 'active', tags: [], created_at: now, updated_at: now, metadata: {},
        hypothesis: '', approach: '', findings: [], conclusion: null, outcome: null,
      });

      const results = nodes.search('WebSocket');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('WebSocket');
    });
  });

  describe('EdgeStore', () => {
    it('应该能插入和查询边', () => {
      const now = new Date().toISOString();
      const goalId = ulid();
      const taskId = ulid();

      nodes.insert({
        id: goalId, type: 'goal', title: 'Goal', description: '', status: 'active',
        tags: [], created_at: now, updated_at: now, metadata: {},
        horizon: 'short', success_criteria: [], priority: 'high',
      });
      nodes.insert({
        id: taskId, type: 'task', title: 'Task', description: '', status: 'proposed',
        tags: [], created_at: now, updated_at: now, metadata: {},
        effort: 'small', priority: 'high', acceptance_criteria: [],
      });

      const edge: Edge = {
        id: ulid(),
        source_id: goalId,
        target_id: taskId,
        relation: 'decomposes_into',
        weight: null,
        annotation: '目标分解为具体任务',
        created_at: now,
      };

      edges.insert(edge);

      const fromGoal = edges.getBySource(goalId);
      expect(fromGoal).toHaveLength(1);
      expect(fromGoal[0].relation).toBe('decomposes_into');

      const toTask = edges.getByTarget(taskId);
      expect(toTask).toHaveLength(1);
    });
  });

  describe('EventStore', () => {
    it('应该能插入和按时间查询事件', () => {
      const now = new Date().toISOString();
      const event: EventRecord = {
        id: ulid(),
        timestamp: now,
        event_type: 'goal.defined',
        actor: 'user',
        operation: 'define_goal',
        node_id: 'test-node-id',
        node_type: 'goal',
        payload: { title: '测试目标' },
        diff: null,
        context: '初始化项目',
      };

      events.insert(event);

      const recent = events.getRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].event_type).toBe('goal.defined');
      expect(recent[0].payload).toEqual({ title: '测试目标' });

      const byNode = events.getByNode('test-node-id');
      expect(byNode).toHaveLength(1);
    });
  });
});
