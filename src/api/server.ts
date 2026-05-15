import { createServer } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { handleMcpRequest, sessions as mcpSessions } from '../mcp/http-server.js';
import type { OperationContext } from '../operations/context.js';
import {
  defineGoal, decomposeGoal, updateGoalStatus,
  beginExploration, recordExplorationFinding, concludeExploration, abandonExploration,
  recordDecision,
  createTask, updateTaskStatus, backfillTask,
  identifyRisk, updateRisk, registerTechDebt,
  recordKnowledge,
  linkNodes, getProjectState, getNodeContext, getTaskContext,
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
} from '../operations/index.js';
import { ProjectManager } from '../projects/index.js';
import { startEmbedSync, getEmbedSyncStats } from '../jobs/embed-sync.js';
import { snakeToCamel, camelToSnake, kebabToSnake } from './transforms.js';

// ============================================================
// 初始化
// ============================================================

const manager = new ProjectManager();

const app = new Hono();

app.use('/api/*', cors());
app.use('/api/*', async (c, next) => {
  const start = Date.now();
  await next();
  console.log(`[API] ${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`);
});
/** 统一响应：将 snake_case 转为 camelCase */
function json(c: any, data: unknown, status?: number) {
  return c.json(snakeToCamel(data), status);
}

// ============================================================
// 监控路由
// ============================================================

app.get('/api/v1/stats/embedding', (c) => {
  return c.json(getEmbedSyncStats());
});

// ============================================================
// 项目管理路由
// ============================================================

app.get('/api/v1/projects', async (c) => {
  return json(c, await manager.listProjects());
});

app.post('/api/v1/projects', async (c) => {
  try {
    const input = await c.req.json();
    const result = await manager.createProject(input);
    return json(c, result, 201);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

app.get('/api/v1/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  const project = await manager.getProject(slug);
  if (!project) return json(c, { error: 'Project not found' }, 404);
  return json(c, project);
});

app.patch('/api/v1/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  try {
    const patch = await c.req.json();
    const result = await manager.updateProject(slug, patch);
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

app.delete('/api/v1/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  await manager.archiveProject(slug);
  return c.body(null, 204);
});

// ============================================================
// 项目级读操作 — /api/v1/projects/:slug/...
// ============================================================

/** Resolve project context from URL slug */
function getCtx(slug: string): OperationContext {
  return manager.getContext(slug);
}

app.get('/api/v1/projects/:slug/state', async (c) => {
  const slug = c.req.param('slug');
  try {
    return json(c, await getProjectState(getCtx(slug)));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/nodes/:id', async (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  try {
    return json(c, await getNodeContext(getCtx(slug), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/tasks/:id/context', async (c) => {
  const slug = c.req.param('slug');
  const taskId = c.req.param('id');
  try {
    return json(c, await getTaskContext(getCtx(slug), taskId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/nodes/:id/history', async (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  const events = await getCtx(slug).eventStore.getByNode(nodeId);
  return json(c, events);
});

app.get('/api/v1/projects/:slug/nodes/:id/trail', async (c) => {
  const slug = c.req.param('slug');
  const nodeId = c.req.param('id');
  try {
    return json(c, await decisionTrail(getCtx(slug), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/search', async (c) => {
  const slug = c.req.param('slug');
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, await getCtx(slug).nodes.search(q));
});

app.get('/api/v1/projects/:slug/events', async (c) => {
  const slug = c.req.param('slug');
  const since = c.req.query('since');
  const limit = c.req.query('limit');
  const ctx = getCtx(slug);
  if (since) return json(c, await ctx.eventStore.getSince(since));
  return json(c, await ctx.eventStore.getRecent(Number(limit) || 20));
});

app.get('/api/v1/projects/:slug/roadmap', async (c) => {
  const slug = c.req.param('slug');
  const rootGoal = c.req.query('root-goal');
  const includeCompleted = c.req.query('include-completed') === 'true';
  const maxDepth = c.req.query('max-depth');
  try {
    const result = await getRoadmap(getCtx(slug), {
      root_goal: rootGoal || undefined,
      include_completed: includeCompleted,
      max_depth: maxDepth ? Number(maxDepth) : undefined,
    });
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/projects/:slug/goals/progress', async (c) => {
  const slug = c.req.param('slug');
  return json(c, await goalProgress(getCtx(slug)));
});

app.get('/api/v1/projects/:slug/knowledge', async (c) => {
  const slug = c.req.param('slug');
  const domain = c.req.query('domain');
  return json(c, await knowledgeMap(getCtx(slug), domain || undefined));
});

app.get('/api/v1/projects/:slug/stale', async (c) => {
  const slug = c.req.param('slug');
  const days = c.req.query('days');
  return json(c, await staleItems(getCtx(slug), days ? Number(days) : undefined));
});

app.get('/api/v1/projects/:slug/blockers', async (c) => {
  const slug = c.req.param('slug');
  return json(c, await currentBlockers(getCtx(slug)));
});

app.get('/api/v1/projects/:slug/activity', async (c) => {
  const slug = c.req.param('slug');
  const limit = c.req.query('limit');
  return json(c, await recentActivity(getCtx(slug), limit ? Number(limit) : undefined));
});

app.get('/api/v1/projects/:slug/fts', async (c) => {
  const slug = c.req.param('slug');
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, await fullTextSearch(getCtx(slug), q));
});

// ============================================================
// 项目级写操作
// ============================================================

const operationHandlers: Record<string, (ctx: OperationContext, input: any) => Promise<any>> = {
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
  backfill_task: backfillTask,
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
    const result = await handler(ctx, snakeInput);
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 400);
  }
});

// ============================================================
// 向后兼容旧路由 — 映射到默认项目
// ============================================================

const defaultCtx = async () => getCtx(await manager.getDefaultProject());

app.get('/api/v1/project/state', async (c) => {
  return json(c, await getProjectState(await defaultCtx()));
});

app.get('/api/v1/nodes/:id', async (c) => {
  const nodeId = c.req.param('id');
  try {
    return json(c, await getNodeContext(await defaultCtx(), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/nodes/:id/history', async (c) => {
  const nodeId = c.req.param('id');
  return json(c, await (await defaultCtx()).eventStore.getByNode(nodeId));
});

app.get('/api/v1/nodes/:id/trail', async (c) => {
  const nodeId = c.req.param('id');
  try {
    return json(c, await decisionTrail(await defaultCtx(), nodeId));
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, await (await defaultCtx()).nodes.search(q));
});

app.get('/api/v1/events', async (c) => {
  const since = c.req.query('since');
  const limit = c.req.query('limit');
  const ctx = await defaultCtx();
  if (since) return json(c, await ctx.eventStore.getSince(since));
  return json(c, await ctx.eventStore.getRecent(Number(limit) || 20));
});

app.get('/api/v1/roadmap', async (c) => {
  const rootGoal = c.req.query('root-goal');
  const includeCompleted = c.req.query('include-completed') === 'true';
  const maxDepth = c.req.query('max-depth');
  try {
    const result = await getRoadmap(await defaultCtx(), {
      root_goal: rootGoal || undefined,
      include_completed: includeCompleted,
      max_depth: maxDepth ? Number(maxDepth) : undefined,
    });
    return json(c, result);
  } catch (e: any) {
    return json(c, { error: e.message }, 404);
  }
});

app.get('/api/v1/goals/progress', async (c) => {
  return json(c, await goalProgress(await defaultCtx()));
});

app.get('/api/v1/knowledge', async (c) => {
  const domain = c.req.query('domain');
  return json(c, await knowledgeMap(await defaultCtx(), domain || undefined));
});

app.get('/api/v1/stale', async (c) => {
  const days = c.req.query('days');
  return json(c, await staleItems(await defaultCtx(), days ? Number(days) : undefined));
});

app.get('/api/v1/blockers', async (c) => {
  return json(c, await currentBlockers(await defaultCtx()));
});

app.get('/api/v1/activity', async (c) => {
  const limit = c.req.query('limit');
  return json(c, await recentActivity(await defaultCtx(), limit ? Number(limit) : undefined));
});

app.get('/api/v1/fts', async (c) => {
  const q = c.req.query('q');
  if (!q) return json(c, { error: 'Missing query parameter "q"' }, 400);
  return json(c, await fullTextSearch(await defaultCtx(), q));
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
    const result = await handler(await defaultCtx(), snakeInput);
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
// 启动 — 统一 HTTP server（REST + MCP 合并）
// ============================================================

const PORT = Number(process.env.SI_BEAVER_PORT) || 7420;

async function start() {
  await manager.init();
  startEmbedSync(manager);

  const honoListener = getRequestListener(app.fetch);

  const httpServer = createServer(async (req, res) => {
    const pathname = req.url?.split('?')[0] ?? '/';

    // CORS preflight for MCP routes
    if (pathname.startsWith('/mcp/') && req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.writeHead(204);
      res.end();
      return;
    }

    // MCP routes: /mcp/{slug}
    if (pathname.startsWith('/mcp/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      const handled = await handleMcpRequest(req, res, manager);
      if (handled) return;
    }

    // Everything else → Hono (REST API + static files)
    honoListener(req, res);
  });

  // Disable idle timeout so long-lived MCP sessions aren't dropped
  httpServer.timeout = 0;
  httpServer.keepAliveTimeout = 120_000;

  httpServer.listen(PORT, () => {
    console.log(`si-beaver running at http://localhost:${PORT} (REST + MCP unified)`);
    console.log(`  REST API: http://localhost:${PORT}/api/v1/...`);
    console.log(`  MCP:      http://localhost:${PORT}/mcp/{slug}`);
  });
}

start().catch((err) => {
  console.error('Failed to start si-beaver:', err);
  process.exit(1);
});

export { app };
