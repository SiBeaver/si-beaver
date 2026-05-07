import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { resolve } from 'path';
import { homedir } from 'os';
import { openDatabase } from '../storage/db.js';
import { OperationContext } from '../operations/context.js';
import {
  defineGoal, decomposeGoal, updateGoalStatus,
  beginExploration, recordExplorationFinding, concludeExploration, abandonExploration,
  recordDecision,
  createTask, updateTaskStatus,
  identifyRisk, updateRisk, registerTechDebt,
  recordKnowledge,
  linkNodes, getProjectState, getNodeContext,
} from '../operations/index.js';

// ============================================================
// 初始化
// ============================================================

const DB_PATH = process.env.SI_BEAVER_DB
  ?? resolve(homedir(), '.si-beaver', 'projects', 'default', 'cognition.db');

const db = openDatabase(DB_PATH);
const ctx = new OperationContext(db);

const app = new Hono();

// ============================================================
// 读操作
// ============================================================

app.get('/api/v1/project/state', (c) => {
  const result = getProjectState(ctx);
  return c.json(result);
});

app.get('/api/v1/nodes/:id', (c) => {
  const nodeId = c.req.param('id');
  try {
    const result = getNodeContext(ctx, nodeId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 404);
  }
});

app.get('/api/v1/nodes/:id/history', (c) => {
  const nodeId = c.req.param('id');
  const events = ctx.eventStore.getByNode(nodeId);
  return c.json(events);
});

app.get('/api/v1/search', (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'Missing query parameter "q"' }, 400);
  const results = ctx.nodes.search(q);
  return c.json(results);
});

app.get('/api/v1/events', (c) => {
  const since = c.req.query('since');
  const limit = c.req.query('limit');
  if (since) {
    return c.json(ctx.eventStore.getSince(since));
  }
  return c.json(ctx.eventStore.getRecent(Number(limit) || 20));
});

// ============================================================
// 写操作 — 统一通过 POST /api/v1/operations/:name
// ============================================================

const operations: Record<string, (ctx: OperationContext, input: any) => any> = {
  define_goal: defineGoal,
  decompose_goal: decomposeGoal,
  update_goal_status: updateGoalStatus,
  begin_exploration: beginExploration,
  record_exploration_finding: recordExplorationFinding,
  conclude_exploration: concludeExploration,
  abandon_exploration: abandonExploration,
  record_decision: recordDecision,
  create_task: createTask,
  update_task_status: updateTaskStatus,
  identify_risk: identifyRisk,
  update_risk: updateRisk,
  register_tech_debt: registerTechDebt,
  record_knowledge: recordKnowledge,
  link_nodes: linkNodes,
};

app.post('/api/v1/operations/:name', async (c) => {
  const name = c.req.param('name');
  const handler = operations[name];
  if (!handler) {
    return c.json({ error: `Unknown operation: ${name}` }, 404);
  }

  try {
    const input = await c.req.json();
    const result = handler(ctx, input);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// ============================================================
// 启动
// ============================================================

const PORT = Number(process.env.SI_BEAVER_PORT) || 7420;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`si-beaver REST API running at http://localhost:${info.port}`);
});

export { app };
