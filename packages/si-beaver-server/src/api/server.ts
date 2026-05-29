import { createServer } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { handleMcpRequest } from '../mcp/http-server.js';
import type { OperationContext, BatchOperationsInput } from '../index.js';
import {
  defineGoal, decomposeGoal, updateGoalStatus,
  beginExploration, recordExplorationFinding, concludeExploration, abandonExploration,
  recordDecision,
  createTask, updateTaskStatus, backfillTask,
  defineRequirement, updateRequirementStatus,
  identifyRisk, updateRisk, registerTechDebt,
  recordKnowledge,
  linkNodes, deleteNode, getProjectState, getNodeContext, getTaskContext,
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
  batchOperations,
  generateProjection, listProjectionTypes,
} from '../index.js';
import { ProjectManager } from '../projects/index.js';
import { startEmbedSync, getEmbedSyncStats } from '../jobs/embed-sync.js';
import { snakeToCamel, camelToSnake, kebabToSnake } from './transforms.js';

// ============================================================
// 操作处理器注册表（导出供 direct-mode 调用方使用）
// ============================================================

export const operationHandlers: Record<string, (ctx: OperationContext, input: any) => Promise<any>> = {
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
  define_requirement: defineRequirement,
  update_requirement_status: updateRequirementStatus,
  identify_risk: identifyRisk,
  update_risk: updateRisk,
  register_tech_debt: registerTechDebt,
  record_knowledge: recordKnowledge,
  link_nodes: linkNodes,
  delete_node: deleteNode,
  generate_projection: generateProjection,
  list_projections: listProjectionTypes,
};

// ============================================================
// createHonoApp — 创建配置好所有路由的 Hono app
// ============================================================

function createHonoApp(manager: ProjectManager, authToken?: string): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.use('/api/*', cors());

  if (authToken) {
    app.use('/api/*', async (c, next) => {
      const auth = c.req.header('Authorization');
      if (auth !== `Bearer ${authToken}`) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    });
  }

  app.use('/api/*', async (c, next) => {
    const start = Date.now();
    await next();
    console.log(`[API] ${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`);
  });

  function json(c: any, data: unknown, status?: number) {
    return c.json(snakeToCamel(data), status);
  }

  function getCtx(slug: string): OperationContext {
    return manager.getContext(slug);
  }

  // === 监控路由 ===

  app.get('/api/v1/stats/embedding', (c) => {
    return c.json(getEmbedSyncStats());
  });

  // === 项目管理路由 ===

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

  // === 项目级读操作 ===

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

  app.get('/api/v1/projects/:slug/projections', async (c) => {
    const slug = c.req.param('slug');
    const project = await manager.getProject(slug);
    if (!project) return json(c, { error: 'Project not found' }, 404);
    const types = await listProjectionTypes();
    const configured = (project.metadata?.projections ?? {}) as Record<string, any>;
    return json(c, {
      available_types: types,
      configured: Object.entries(configured).map(([key, cfg]: [string, any]) => ({
        ...cfg,
        id: key,
      })),
    });
  });

  app.post('/api/v1/projects/:slug/projections/:type/generate', async (c) => {
    const slug = c.req.param('slug');
    const type = c.req.param('type');
    const project = await manager.getProject(slug);
    if (!project) return json(c, { error: 'Project not found' }, 404);
    const projections = (project.metadata?.projections ?? {}) as Record<string, any>;
    const config = projections[type];
    if (!config) {
      return json(c, { error: `No projection config for type "${type}"` }, 400);
    }
    try {
      const result = await generateProjection(getCtx(slug), { type, config });
      return json(c, result);
    } catch (e: any) {
      return json(c, { error: e.message }, 400);
    }
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

  // === 项目级写操作 ===

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

  app.post('/api/v1/projects/:slug/batch', async (c) => {
    const slug = c.req.param('slug');
    try {
      const ctx = getCtx(slug);
      const input = await c.req.json();
      const snakeInput = camelToSnake(input) as BatchOperationsInput;
      const result = await batchOperations(ctx, snakeInput, operationHandlers);
      return json(c, result);
    } catch (e: any) {
      return json(c, { error: e.message }, 400);
    }
  });

  // === 向后兼容旧路由 ===

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

  app.post('/api/v1/batch', async (c) => {
    try {
      const input = await c.req.json();
      const snakeInput = camelToSnake(input) as BatchOperationsInput;
      const result = await batchOperations(await defaultCtx(), snakeInput, operationHandlers);
      return json(c, result);
    } catch (e: any) {
      return json(c, { error: e.message }, 400);
    }
  });

  // === 前端静态文件 ===

  const WEB_DIST = resolve(import.meta.dirname ?? '.', '../../si-beaver-web/dist');

  if (existsSync(WEB_DIST)) {
    app.use('/*', serveStatic({ root: WEB_DIST }));
    app.get('*', serveStatic({ root: WEB_DIST, path: '/index.html' }));
    console.log(`Serving frontend from ${WEB_DIST}`);
  }

  return app;
}

// ============================================================
// createSiBeaverApp — 工厂函数，不启动 HTTP server
// ============================================================

export interface SiBeaverApp {
  app: Hono;
  manager: ProjectManager;
  handleMcpRequest: typeof handleMcpRequest;
}

export function createSiBeaverApp(authToken?: string): SiBeaverApp {
  const manager = new ProjectManager();
  const app = createHonoApp(manager, authToken);
  return { app, manager, handleMcpRequest };
}

// ============================================================
// start — 独立模式：创建 HTTP server 并启动
// ============================================================

async function start() {
  const AUTH_TOKEN = process.env.SI_BEAVER_AUTH_TOKEN;
  if (!AUTH_TOKEN) {
    console.error('FATAL: SI_BEAVER_AUTH_TOKEN environment variable is required');
    process.exit(1);
  }

  const { app, manager, handleMcpRequest } = createSiBeaverApp(AUTH_TOKEN);

  await manager.init();
  startEmbedSync(manager);

  const honoListener = getRequestListener(app.fetch);

  const httpServer = createServer(async (req, res) => {
    const pathname = req.url?.split('?')[0] ?? '/';

    if (pathname.startsWith('/mcp/') && req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname.startsWith('/mcp/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const auth = req.headers['authorization'];
      if (auth !== `Bearer ${AUTH_TOKEN}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const handled = await handleMcpRequest(req, res, manager);
      if (handled) return;
    }

    honoListener(req, res);
  });

  httpServer.timeout = 0;
  httpServer.keepAliveTimeout = 120_000;

  const PORT = Number(process.env.SI_BEAVER_PORT) || 7420;

  httpServer.listen(PORT, () => {
    console.log(`si-beaver running at http://localhost:${PORT} (REST + MCP unified)`);
    console.log(`  REST API: http://localhost:${PORT}/api/v1/...`);
    console.log(`  MCP:      http://localhost:${PORT}/mcp/{slug}`);
    console.log(`  Auth:     Bearer token ENABLED`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[server] Received ${signal}, shutting down...`);
    httpServer.close(() => {
      console.log('[server] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function isMainModule(): boolean {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('server.js') || entry.endsWith('server.ts') ||
         entry.includes('/api/server.');
}

if (isMainModule()) {
  start().catch((err) => {
    console.error('Failed to start si-beaver:', err);
    process.exit(1);
  });
}
