// ============================================================
// index.ts — si-beaver-cloud 统一入口
//
// 单一进程、单一端口，包含 si-beaver 全部功能 + Cloud 独有功能。
// Cloud 功能直接调用 si-beaver 的 operation handler，不走 HTTP。
// ============================================================

import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import {
  createSiBeaverApp,
  operationHandlers,
  startEmbedSync,
  type SiBeaverApp,
  type OperationContext,
  getProjectState,
  getNodeContext,
} from '@si-beaver/server';
import { ProjectManager } from '@si-beaver/server';
import { initTools, listTools, config } from '@si-beaver/server';
import {
  startPoller,
  onEvent,
  setDirectSibs,
  setDirectEventSource,
  type DirectSibsContext,
  type DirectEventSource,
} from '@si-beaver/server';
import { healthRoutes } from './api/routes/health.js';
import { workflowRoutes } from './api/routes/workflows.js';
import { distillRoutes } from './api/routes/distill.js';
import { handleRequirementAccepted } from './workflow/triggers/requirement-trigger.js';
import { handleKnowledgeRecorded } from './workflow/self-heal.js';
import { handleTaskCompleted } from './workflow/satisfaction-check.js';

// ============================================================
// 构建 DirectSibsContext — 将 operationHandlers 桥接到 sibs 接口
// ============================================================

function camelToSnake(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
    result[snakeKey] = camelToSnake(value);
  }
  return result;
}

function buildDirectSibs(manager: ProjectManager, slug: string): DirectSibsContext {
  const getCtx = (): OperationContext => manager.getContext(slug);

  return {
    getProjectState: () => getProjectState(getCtx()) as any,
    getNodeContext: (nodeId: string) => getNodeContext(getCtx(), nodeId) as any,

    getEvents: async (since?: string, limit = 50) => {
      const ctx = getCtx();
      if (since) {
        const events = await ctx.eventStore.getSince(since);
        return { events: events as any[] };
      }
      const events = await ctx.eventStore.getRecent(limit);
      return { events: events as any[] };
    },

    defineGoal: (input) =>
      operationHandlers.define_goal(getCtx(), camelToSnake(input)),

    createTask: (input) =>
      operationHandlers.create_task(getCtx(), camelToSnake(input)),

    updateRequirementStatus: (input) =>
      operationHandlers.update_requirement_status(getCtx(), camelToSnake(input)),

    linkNodes: (input) =>
      operationHandlers.link_nodes(getCtx(), camelToSnake(input)),

    recordKnowledge: (input) =>
      operationHandlers.record_knowledge(getCtx(), camelToSnake(input)),

    identifyRisk: (input) =>
      operationHandlers.identify_risk(getCtx(), camelToSnake(input)),
  };
}

// ============================================================
// 构建 DirectEventSource — 直接查 eventStore
// ============================================================

function buildDirectEventSource(manager: ProjectManager, slug: string): DirectEventSource {
  return {
    getEvents: async (since?: string, limit = 50) => {
      const ctx = manager.getContext(slug);
      if (since) {
        const events = await ctx.eventStore.getSince(since);
        return { events: events as any[] };
      }
      const events = await ctx.eventStore.getRecent(limit);
      return { events: events as any[] };
    },
  };
}

// ============================================================
// start — 启动统一服务器
// ============================================================

export async function start() {
  const authToken = process.env.AUTH_TOKEN || process.env.SI_BEAVER_AUTH_TOKEN;
  if (authToken) {
    console.log('[sibsc] Auth token configured');
  } else {
    console.warn('[sibsc] No AUTH_TOKEN set — API routes will be unauthenticated');
  }

  const { app, manager, handleMcpRequest } = createSiBeaverApp(authToken);

  await manager.init();
  startEmbedSync(manager);

  initTools();

  const projectSlug = config.sibsProject || await manager.getDefaultProject();
  console.log(`[sibsc] project=${projectSlug}`);

  setDirectSibs(buildDirectSibs(manager, projectSlug));
  setDirectEventSource(buildDirectEventSource(manager, projectSlug));

  onEvent('requirement.status_changed', handleRequirementAccepted);
  onEvent('knowledge.recorded', handleKnowledgeRecorded);
  onEvent('task.status_changed', handleTaskCompleted);

  app.route('/health', healthRoutes);
  app.get('/api/v1/tools', (c) => c.json({ tools: listTools() }));
  app.get('/api/v1/config', (c) => c.json({
    sibsProject: config.sibsProject,
    llmModel: config.llmModel,
    pollInterval: config.pollInterval,
  }));
  app.route('/api/v1/workflows', workflowRoutes);
  app.route('/api/v1/distill', distillRoutes);

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

      if (authToken) {
        const auth = req.headers['authorization'];
        if (auth !== `Bearer ${authToken}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }

      const handled = await handleMcpRequest(req, res, manager);
      if (handled) return;
    }

    honoListener(req, res);
  });

  httpServer.timeout = 0;
  httpServer.keepAliveTimeout = 120_000;

  const PORT = Number(process.env.PORT) || Number(process.env.SI_BEAVER_PORT) || 7420;

  httpServer.listen(PORT, () => {
    console.log(`sibsc running at http://localhost:${PORT}`);
    console.log(`  REST API:  http://localhost:${PORT}/api/v1/...`);
    console.log(`  MCP:       http://localhost:${PORT}/mcp/{slug}`);
    console.log(`  Cloud:     http://localhost:${PORT}/api/v1/workflows`);
    console.log(`  Frontend:  http://localhost:${PORT}/`);

    startPoller();
  });

  const shutdown = (signal: string) => {
    console.log(`[sibsc] Received ${signal}, shutting down...`);
    httpServer.close(() => {
      console.log('[sibsc] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[sibsc] Forced shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, manager, httpServer };
}

// ============================================================
// 直接执行时自动启动
// ============================================================

const entry = process.argv[1] ?? '';
if (entry.includes('index.')) {
  start().catch((err) => {
    console.error('Failed to start sibsc server:', err);
    process.exit(1);
  });
}
