import { createServer } from 'node:http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { handleMcpRequest } from '../mcp/http-server.js';
import { chatCompletion, jsonCompletion, type ChatMessage } from '../llm-client.js';
import type { OperationContext, BatchOperationsInput } from '../index.js';
import {
  defineGoal, decomposeGoal, updateGoalStatus,
  beginExploration, recordExplorationFinding, concludeExploration, abandonExploration,
  recordDecision,
  defineRequirement, updateRequirementStatus,
  defineCapability, updateCapability, getCapabilityTree, getCockpit,
  identifyRisk, updateRisk, registerTechDebt,
  recordKnowledge, updateKnowledge, getKnowledgeTree, pinKnowledge, moveKnowledge,
  linkNodes, deleteNode, getProjectState, getNodeContext,
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
  getHelmSignals,
  batchOperations,
  generateProjection, listProjectionTypes,
} from '../index.js';
import { ProjectManager } from '../projects/index.js';
import { startEmbedSync, getEmbedSyncStats } from '../jobs/embed-sync.js';
import { snakeToCamel, camelToSnake, kebabToSnake } from './transforms.js';
import { triggerAutoLink, AUTO_LINK_OPERATIONS } from '../auto-link/index.js';

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
  define_requirement: defineRequirement,
  update_requirement_status: updateRequirementStatus,
  define_capability: defineCapability,
  update_capability: updateCapability,
  identify_risk: identifyRisk,
  update_risk: updateRisk,
  register_tech_debt: registerTechDebt,
  record_knowledge: recordKnowledge,
  update_knowledge: updateKnowledge,
  pin_knowledge: pinKnowledge,
  move_knowledge: moveKnowledge,
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

  app.get('/api/v1/projects/:slug/nodes', async (c) => {
    const slug = c.req.param('slug');
    const type = c.req.query('type');
    if (!type) return json(c, { error: 'Query parameter "type" is required' }, 400);
    const nodes = await getCtx(slug).nodes.getByType(type as any);
    return json(c, nodes);
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

  app.get('/api/v1/projects/:slug/knowledge/tree', async (c) => {
    const slug = c.req.param('slug');
    return json(c, await getKnowledgeTree(getCtx(slug)));
  });

  app.get('/api/v1/projects/:slug/capabilities/tree', async (c) => {
    const slug = c.req.param('slug');
    return json(c, await getCapabilityTree(getCtx(slug)));
  });

  app.get('/api/v1/projects/:slug/cockpit', async (c) => {
    const slug = c.req.param('slug');
    return json(c, await getCockpit(getCtx(slug)));
  });

  app.get('/api/v1/projects/:slug/cockpit-view', async (c) => {
    const slug = c.req.param('slug');
    const project = await manager.getProject(slug);
    if (!project) return json(c, { error: 'Project not found' }, 404);
    const config = project.metadata?.cockpitView as any;
    if (!config) return json(c, { error: 'No cockpitView configured in project metadata' }, 404);

    const { tree } = await getCapabilityTree(getCtx(slug));
    const treeByTitle = new Map(tree.map(n => [n.title, n]));

    const layers = (config.layers ?? []).map((layer: any) => ({
      id: layer.id,
      label: layer.label,
      capabilities: (layer.capabilities ?? [])
        .map((title: string) => treeByTitle.get(title))
        .filter(Boolean),
    }));

    return json(c, { mode: config.mode, layers });
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

  app.get('/api/v1/projects/:slug/helm', async (c) => {
    const slug = c.req.param('slug');
    return json(c, await getHelmSignals(getCtx(slug)));
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

  // === 知识蒸馏 & 对话 ===

  app.post('/api/v1/projects/:slug/knowledge/distill', async (c) => {
    const slug = c.req.param('slug');
    const body = await c.req.json();
    const { text, domain, source } = body as { text: string; domain?: string; source?: string };
    if (!text) return json(c, { error: 'Missing "text" field' }, 400);

    const ctx = getCtx(slug);
    const treeResult = await getKnowledgeTree(ctx);
    const anchors = treeResult.tree.filter((n: any) => n.pinned);
    const anchorSummary = anchors.map((a: any) =>
      `- id="${a.id}" title="${a.title}" domain="${a.domain}" (子项: ${a.children.length})`
    ).join('\n');
    const existingFlat = treeResult.tree.flatMap((n: any) => {
      const items = [{ id: n.id, title: n.title, domain: n.domain }];
      for (const ch of n.children) items.push({ id: ch.id, title: ch.title, domain: ch.domain });
      return items;
    });
    const existingSummary = existingFlat.slice(0, 40)
      .map((k: any) => `- id="${k.id}" [${k.domain}] ${k.title}`).join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个 AI-first 知识库工程师。用户提供零散文本，你需要决定如何将其整合到知识库中。

## 当前知识库锚点（顶层主题，人工设定，不可移动）：
${anchorSummary || '（暂无锚点）'}

## 已有知识条目：
${existingSummary || '（暂无）'}

## 你的决策

对于提取的每个知识点，你必须决定 action：
- "create": 创建全新条目
- "update": 更新已有条目（提供 target_id）
- "merge": 将多个已有条目合并为一个新条目（提供 merge_ids）

## 输出 JSON 格式：
{
  "actions": [
    {
      "action": "create",
      "title": "简洁标题",
      "description": "一句话摘要",
      "content": "详细内容（markdown）",
      "domain": "领域",
      "confidence": "low|medium|high",
      "parent_id": "父节点ID（匹配锚点或已有条目）或 null",
      "tags": []
    },
    {
      "action": "update",
      "target_id": "要更新的条目ID",
      "title": "更新后标题（可选）",
      "description": "更新后摘要（可选）",
      "content": "更新后详细内容（可选）",
      "domain": "领域（可选）"
    },
    {
      "action": "merge",
      "merge_ids": ["id1", "id2"],
      "title": "合并后标题",
      "description": "合并后摘要",
      "content": "合并后详细内容",
      "domain": "领域",
      "parent_id": "父节点ID 或 null"
    }
  ],
  "summary": "简要说明做了什么操作"
}

## 规则：
- 优先更新已有条目而非创建重复条目
- 如果多个碎片讨论同一主题，考虑合并
- parent_id 优先匹配锚点，无合适锚点时设为 null
- content 使用 markdown 格式，可以较长
- 如果文本无实质知识内容，返回空 actions 数组`,
      },
      { role: 'user', content: text },
    ];

    interface DistillAction {
      action: 'create' | 'update' | 'merge';
      target_id?: string;
      merge_ids?: string[];
      title?: string;
      description?: string;
      content?: string;
      domain?: string;
      confidence?: 'low' | 'medium' | 'high';
      parent_id?: string | null;
      tags?: string[];
    }
    interface DistillResult { actions: DistillAction[]; summary: string; }

    try {
      const result = await jsonCompletion<DistillResult>(messages);
      const created: any[] = [];
      const updated: any[] = [];
      const merged: any[] = [];

      for (const act of result.actions) {
        if (act.action === 'create') {
          const res = await recordKnowledge(ctx, {
            title: act.title!,
            description: act.description || '',
            content: act.content || '',
            domain: act.domain || domain || 'general',
            confidence: act.confidence || 'medium',
            source: source || 'distill',
            parent_id: act.parent_id,
            tags: act.tags,
          });
          created.push(res.knowledge);
        } else if (act.action === 'update' && act.target_id) {
          const res = await updateKnowledge(ctx, {
            knowledge_id: act.target_id,
            title: act.title,
            description: act.description,
            content: act.content,
            domain: act.domain,
          });
          updated.push(res.knowledge);
        } else if (act.action === 'merge' && act.merge_ids?.length) {
          const res = await recordKnowledge(ctx, {
            title: act.title!,
            description: act.description || '',
            content: act.content || '',
            domain: act.domain || domain || 'general',
            confidence: act.confidence || 'medium',
            source: source || 'distill-merge',
            parent_id: act.parent_id,
            invalidates: act.merge_ids,
            tags: act.tags,
          });
          merged.push(res.knowledge);
        }
      }

      return json(c, { created, updated, merged, summary: result.summary });
    } catch (e: any) {
      return json(c, { error: e.message }, 500);
    }
  });

  app.post('/api/v1/projects/:slug/knowledge/chat', async (c) => {
    const slug = c.req.param('slug');
    const body = await c.req.json();
    const { messages: userMessages, action } = body as {
      messages: ChatMessage[];
      action?: 'chat' | 'save';
    };
    if (!userMessages || !Array.isArray(userMessages)) {
      return json(c, { error: 'Missing "messages" array' }, 400);
    }

    const ctx = getCtx(slug);
    const existing = await knowledgeMap(ctx);
    const existingSummary = (existing.knowledge || []).slice(0, 30)
      .map((k: any) => `- [${k.domain}] ${k.title}: ${k.description?.slice(0, 60) || ''}`).join('\n');

    const systemMsg: ChatMessage = {
      role: 'system',
      content: `你是一个知识管理助手，帮助用户整理和归纳项目知识。

当前知识库概览：
${existingSummary || '（暂无）'}

你可以：
1. 回答用户关于现有知识的问题
2. 帮助用户把零散想法整理为结构化知识
3. 当用户确认要保存时，输出以下 JSON 格式（用 \`\`\`json 包裹）：
\`\`\`json
{"save": [{"title": "...", "description": "...", "domain": "...", "confidence": "medium", "tags": []}]}
\`\`\`

在普通对话中不要输出 JSON，只在用户明确说"保存"、"记录"、"存入知识库"时才输出。`,
    };

    const fullMessages = [systemMsg, ...userMessages];

    try {
      const llmRes = await chatCompletion(fullMessages);
      let saved: any[] = [];

      if (action === 'save' || llmRes.content.includes('"save"')) {
        const jsonMatch = llmRes.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.save && Array.isArray(parsed.save)) {
              for (const item of parsed.save) {
                const res = await recordKnowledge(ctx, {
                  title: item.title,
                  description: item.description,
                  domain: item.domain || 'general',
                  confidence: item.confidence || 'medium',
                  source: item.source || 'chat',
                  tags: item.tags,
                });
                saved.push(res.knowledge);
              }
            }
          } catch { /* JSON parse failed, just return the message */ }
        }
      }

      return json(c, { reply: llmRes.content, reasoning: llmRes.reasoning || null, saved });
    } catch (e: any) {
      return json(c, { error: e.message }, 500);
    }
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
      if (AUTO_LINK_OPERATIONS.has(snakeName)) triggerAutoLink(ctx, result);
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
      const ctx = await defaultCtx();
      const result = await handler(ctx, snakeInput);
      if (AUTO_LINK_OPERATIONS.has(snakeName)) triggerAutoLink(ctx, result);
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
