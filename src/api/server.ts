import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import type { OperationContext } from '../operations/context.js';
import {
  defineGoal, decomposeGoal, updateGoalStatus,
  beginExploration, recordExplorationFinding, concludeExploration, abandonExploration,
  recordDecision,
  createTask, updateTaskStatus,
  identifyRisk, updateRisk, registerTechDebt,
  recordKnowledge,
  linkNodes, getProjectState, getNodeContext,
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
} from '../operations/index.js';
import { ProjectManager } from '../projects/index.js';
import { snakeToCamel, camelToSnake, kebabToSnake } from './transforms.js';

// ============================================================
// 初始化
// ============================================================

const BASE_PATH = process.env.SI_BEAVER_HOME
  ?? resolve(homedir(), '.si-beaver');

const manager = new ProjectManager(BASE_PATH);

const app = new Hono();

app.use('/api/*', cors());
/** 统一响应：将 snake_case 转为 camelCase */
function json(c: any, data: unknown, status?: number) {
  return c.json(snakeToCamel(data), status);
}

// ============================================================
// 项目管理路由
// ============================================================

app.get('/api/v1/projects', (c) => {
  return json(c, manager.listProjects());
});

app.post('/api/v1/projects', async (c) => {
  try {
    const input = await c.req.json();
    const result = manager.createProject(input);
    return json(c, result, 201);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

app.get('/api/v1/projects/:slug', (c) => {
  const slug = c.req.param('slug');
  const project = manager.getProject(slug);
  if (!project) return json(c, { error: 'Project not found' }, 404);
  return json(c, project);
});

app.patch('/api/v1/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  try {
    const patch = await c.req.json();
    const result = manager.updateProject(slug, patch);
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

app.delete('/api/v1/projects/:slug', (c) => {
  const slug = c.req.param('slug');
  manager.archiveProject(slug);
  return c.body(null, 204);
});

// ============================================================
// 项目级读操作 — /api/v1/projects/:slug/...
// ============================================================

/** Resolve project context from URL slug */
function getCtx(slug: string): OperationContext {
  return manager.getContext(slug);
}

app.get('/api/v1/projects/:slug/state', (c) => {
  const slug = c.req.param('slug');
  try {
    return json(c, getProjectState(getCtx(slug)));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/nodes/:id', (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  try {
    return json(c, getNodeContext(getCtx(slug), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/nodes/:id/history', (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  const events = getCtx(slug).eventStore.getByNode(nodeId);
  return json(c, events);
});

app.get('/api/v1/projects/:slug/nodes/:id/trail', (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  try {
    return json(c, decisionTrail(getCtx(slug), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/search', (c) => {
  const slug = c.req.param('slug');
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, getCtx(slug).nodes.search(q));
});

app.get('/api/v1/projects/:slug/events', (c) => {
  const slug = c.req.param('slug');
  const since = c.req.query('since');
  const limit = c.req.query('limit');
  const ctx = getCtx(slug);
  if (since) return json(c, ctx.eventStore.getSince(since));
  return json(c, ctx.eventStore.getRecent(Number(limit) || 20));
});

app.get('/api/v1/projects/:slug/roadmap', (c) => {
  const slug = c.req.param('slug');
  const rootGoal = c.req.query('root-goal');
  const includeCompleted = c.req.query('include-completed') === 'true';
  const maxDepth = c.req.query('max-depth');
  try {
    const result = getRoadmap(getCtx(slug), {
      root_goal: rootGoal || undefined,
      include_completed: includeCompleted,
      max_depth: maxDepth ? Number(maxDepth) : undefined,
    });
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/goals/progress', (c) => {
  const slug = c.req.param('slug');
  return json(c, goalProgress(getCtx(slug)));
});

app.get('/api/v1/projects/:slug/knowledge', (c) => {
  const slug = c.req.param('slug');
  const domain = c.req.query('domain');
  return json(c, knowledgeMap(getCtx(slug), domain || undefined));
});

app.get('/api/v1/projects/:slug/stale', (c) => {
  const slug = c.req.param('slug');
  const days = c.req.query('days');
  return json(c, staleItems(getCtx(slug), days ? Number(days) : undefined));
});

app.get('/api/v1/projects/:slug/blockers', (c) => {
  const slug = c.req.param('slug');
  return json(c, currentBlockers(getCtx(slug)));
});

app.get('/api/v1/projects/:slug/activity', (c) => {
  const slug = c.req.param('slug');
  const limit = c.req.query('limit');
  return json(c, recentActivity(getCtx(slug), limit ? Number(limit) : undefined));
});

app.get('/api/v1/projects/:slug/fts', (c) => {
  const slug = c.req.param('slug');
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, fullTextSearch(getCtx(slug), q));
});

// ============================================================
// 项目级写操作
// ============================================================

const operationHandlers: Record<string, (ctx: OperationContext, input: any) => any> = {
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

app.post('/api/v1/projects/:slug/operations/:name', async (c) => {
  const slug = c.req.param('slug');
  const name = c.req.param('name');
  const snakeName = kebabToSnake(name);
  const handler = operationHandlers[snakeName];
  if (!handler) {
    return json(c, { error: `Unknown operation: ${name}` }, 404);
  }

  try {
    const ctx = getCtx(slug);
    const input = await c.req.json();
    const snakeInput = camelToSnake(input);
    const result = handler(ctx, snakeInput);
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

// ============================================================
// 向后兼容旧路由 — 映射到默认项目
// ============================================================

const defaultCtx = () => getCtx(manager.getDefaultProject());

app.get('/api/v1/project/state', (c) => {
  return json(c, getProjectState(defaultCtx()));
});

app.get('/api/v1/nodes/:id', (c) => {
  const nodeId = c.req.param('id');
  try {
    return json(c, getNodeContext(defaultCtx(), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/nodes/:id/history', (c) => {
  const nodeId = c.req.param('id');
  return json(c, defaultCtx().eventStore.getByNode(nodeId));
});

app.get('/api/v1/nodes/:id/trail', (c) => {
  const nodeId = c.req.param('id');
  try {
    return json(c, decisionTrail(defaultCtx(), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/search', (c) => {
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, defaultCtx().nodes.search(q));
});

app.get('/api/v1/events', (c) => {
  const since = c.req.query('since');
  const limit = c.req.query('limit');
  const ctx = defaultCtx();
  if (since) return json(c, ctx.eventStore.getSince(since));
  return json(c, ctx.eventStore.getRecent(Number(limit) || 20));
});

app.get('/api/v1/roadmap', (c) => {
  const rootGoal = c.req.query('root-goal');
  const includeCompleted = c.req.query('include-completed') === 'true';
  const maxDepth = c.req.query('max-depth');
  try {
    const result = getRoadmap(defaultCtx(), {
      root_goal: rootGoal || undefined,
      include_completed: includeCompleted,
      max_depth: maxDepth ? Number(maxDepth) : undefined,
    });
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/goals/progress', (c) => {
  return json(c, goalProgress(defaultCtx()));
});

app.get('/api/v1/knowledge', (c) => {
  const domain = c.req.query('domain');
  return json(c, knowledgeMap(defaultCtx(), domain || undefined));
});

app.get('/api/v1/stale', (c) => {
  const days = c.req.query('days');
  return json(c, staleItems(defaultCtx(), days ? Number(days) : undefined));
});

app.get('/api/v1/blockers', (c) => {
  return json(c, currentBlockers(defaultCtx()));
});

app.get('/api/v1/activity', (c) => {
  const limit = c.req.query('limit');
  return json(c, recentActivity(defaultCtx(), limit ? Number(limit) : undefined));
});

app.get('/api/v1/fts', (c) => {
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, fullTextSearch(defaultCtx(), q));
});

app.post('/api/v1/operations/:name', async (c) => {
  const name = c.req.param('name');
  const snakeName = kebabToSnake(name);
  const handler = operationHandlers[snakeName];
  if (!handler) {
    return json(c, { error: `Unknown operation: ${name}` }, 404);
  }
  try {
    const input = await c.req.json();
    const snakeInput = camelToSnake(input);
    const result = handler(defaultCtx(), snakeInput);
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

// ============================================================
// 生产环境：托管前端静态文件
// ============================================================

const WEB_DIST = resolve(import.meta.dirname ?? '.', '../../web/dist');

if (existsSync(WEB_DIST)) {
  app.use('/*', serveStatic({ root: WEB_DIST }));
  // SPA fallback: 非 API 路由返回 index.html
  app.get('*', serveStatic({ root: WEB_DIST, path: '/index.html' }));
  console.log(`Serving frontend from ${WEB_DIST}`);
}

// ============================================================
// 启动
// ============================================================

const PORT = Number(process.env.SI_BEAVER_PORT) || 7420;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`si-beaver REST API running at http://localhost:${info.port} (multi-project)`);
});

export { app };
