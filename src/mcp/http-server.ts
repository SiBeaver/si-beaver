/**
 * MCP Server with Streamable HTTP transport.
 * Exposes si-beaver MCP tools over HTTP for remote clients.
 */
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { resolve } from 'path';
import { homedir } from 'os';
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

// ============================================================
// 初始化
// ============================================================

const BASE_PATH = process.env.SI_BEAVER_HOME
  ?? resolve(homedir(), '.si-beaver');

const manager = new ProjectManager(BASE_PATH);

function ctx(project?: string) {
  return manager.getContext(project ?? manager.getDefaultProject());
}

const projectParam = z.string().optional().describe('项目 slug（默认使用当前默认项目）');

// ============================================================
// MCP Server 实例
// ============================================================

const server = new McpServer({
  name: 'si-beaver',
  version: '0.2.0',
});

// --- 项目管理工具 ---

server.tool('list_projects', '列出所有项目', {}, async () => {
  return { content: [{ type: 'text', text: JSON.stringify(manager.listProjects(), null, 2) }] };
});

server.tool('create_project', '创建一个新项目', {
  slug: z.string().describe('项目标识符'),
  name: z.string().describe('项目显示名称'),
  description: z.string().optional().describe('项目描述'),
}, async (args) => {
  const result = manager.createProject(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('set_default_project', '设置默认项目', {
  slug: z.string().describe('项目 slug'),
}, async (args) => {
  manager.setDefaultProject(args.slug);
  return { content: [{ type: 'text', text: `Default project set to "${args.slug}"` }] };
});

server.tool('get_current_project', '获取当前默认项目', {}, async () => {
  const slug = manager.getDefaultProject();
  const project = manager.getProject(slug);
  return { content: [{ type: 'text', text: JSON.stringify({ slug, project }, null, 2) }] };
});

// --- 目标 ---

server.tool('define_goal', '定义一个项目目标', {
  project: projectParam,
  title: z.string(), description: z.string().optional(),
  horizon: z.enum(['short', 'medium', 'long']),
  success_criteria: z.array(z.string()).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  parent_goal: z.string().optional(), tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(defineGoal(ctx(project), args), null, 2) }] };
});

server.tool('decompose_goal', '将目标分解为子目标、任务和探索', {
  project: projectParam,
  goal_id: z.string(),
  sub_goals: z.array(z.object({ title: z.string(), description: z.string().optional(), horizon: z.enum(['short', 'medium', 'long']), success_criteria: z.array(z.string()).optional(), priority: z.enum(['critical', 'high', 'medium', 'low']).optional() })).optional(),
  tasks: z.array(z.object({ title: z.string(), description: z.string().optional(), effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(), priority: z.enum(['critical', 'high', 'medium', 'low']).optional(), acceptance_criteria: z.array(z.string()).optional() })).optional(),
  explorations_needed: z.array(z.object({ topic: z.string(), reason: z.string(), hypothesis: z.string().optional() })).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(decomposeGoal(ctx(project), args), null, 2) }] };
});

server.tool('update_goal_status', '更新目标状态', {
  project: projectParam,
  goal_id: z.string(), new_status: z.enum(['active', 'achieved', 'abandoned', 'deferred']), reason: z.string(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(updateGoalStatus(ctx(project), args), null, 2) }] };
});

// --- 探索 ---

server.tool('begin_exploration', '开始探索性调查', {
  project: projectParam,
  topic: z.string(), reason: z.string(),
  hypothesis: z.string().optional(), approach: z.string().optional(),
  related_goals: z.array(z.string()).optional(), triggered_by: z.string().optional(), tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(beginExploration(ctx(project), args), null, 2) }] };
});

server.tool('record_exploration_finding', '记录探索发现', {
  project: projectParam,
  exploration_id: z.string(), finding: z.string(), significance: z.enum(['minor', 'major', 'breakthrough']),
  related_nodes: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(recordExplorationFinding(ctx(project), args), null, 2) }] };
});

server.tool('conclude_exploration', '结论化探索', {
  project: projectParam,
  exploration_id: z.string(), conclusion: z.string(), outcome: z.enum(['validated', 'invalidated', 'partial', 'inconclusive']),
  decisions: z.array(z.object({ title: z.string(), context: z.string().optional(), rationale: z.string(), consequences: z.array(z.string()).optional() })).optional(),
  knowledge: z.array(z.object({ title: z.string(), domain: z.string(), description: z.string(), confidence: z.enum(['low', 'medium', 'high']).optional() })).optional(),
  follow_up_tasks: z.array(z.object({ title: z.string(), description: z.string().optional(), effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional() })).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(concludeExploration(ctx(project), args), null, 2) }] };
});

server.tool('abandon_exploration', '放弃探索', {
  project: projectParam,
  exploration_id: z.string(), reason: z.string(), learnings: z.string().optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(abandonExploration(ctx(project), args), null, 2) }] };
});

// --- 决策 ---

server.tool('record_decision', '记录架构/设计决策', {
  project: projectParam,
  title: z.string(), context: z.string(), rationale: z.string(),
  alternatives_considered: z.array(z.object({ option: z.string(), pros: z.array(z.string()).optional(), cons: z.array(z.string()).optional(), reason_rejected: z.string() })).optional(),
  consequences: z.array(z.string()).optional(),
  related_goals: z.array(z.string()).optional(), related_explorations: z.array(z.string()).optional(),
  supersedes: z.string().optional(),
  risks_created: z.array(z.object({ title: z.string(), description: z.string(), likelihood: z.enum(['low', 'medium', 'high']), impact: z.enum(['low', 'medium', 'high', 'critical']) })).optional(),
  tech_debt_created: z.array(z.object({ title: z.string(), description: z.string(), severity: z.enum(['low', 'medium', 'high', 'critical']), affected_area: z.string(), cost_of_delay: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(recordDecision(ctx(project), args), null, 2) }] };
});

// --- 任务 ---

server.tool('create_task', '创建任务', {
  project: projectParam,
  title: z.string(), description: z.string().optional(),
  effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  parent_goal: z.string().optional(), addresses_tech_debt: z.string().optional(), mitigates_risk: z.string().optional(),
  tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(createTask(ctx(project), args), null, 2) }] };
});

server.tool('update_task_status', '更新任务状态', {
  project: projectParam,
  task_id: z.string(), new_status: z.enum(['proposed', 'ready', 'in_progress', 'done', 'cancelled']),
  reason: z.string().optional(),
  artifacts: z.array(z.object({ title: z.string(), artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']), uri: z.string().optional(), content_summary: z.string().optional() })).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(updateTaskStatus(ctx(project), args), null, 2) }] };
});

// --- 风险与技术债 ---

server.tool('identify_risk', '识别项目风险', {
  project: projectParam,
  title: z.string(), description: z.string(),
  likelihood: z.enum(['low', 'medium', 'high']), impact: z.enum(['low', 'medium', 'high', 'critical']),
  trigger_conditions: z.array(z.string()).optional(), affected_goals: z.array(z.string()).optional(),
  mitigation_strategy: z.string().optional(), tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(identifyRisk(ctx(project), args), null, 2) }] };
});

server.tool('update_risk', '更新风险状态', {
  project: projectParam,
  risk_id: z.string(), reason: z.string(),
  new_status: z.enum(['identified', 'analyzing', 'mitigated', 'accepted', 'occurred', 'resolved']).optional(),
  likelihood: z.enum(['low', 'medium', 'high']).optional(),
  impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  mitigation_strategy: z.string().optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(updateRisk(ctx(project), args), null, 2) }] };
});

server.tool('register_tech_debt', '注册技术债', {
  project: projectParam,
  title: z.string(), description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  affected_area: z.string(), cost_of_delay: z.string(),
  resolution_approach: z.string().optional(), caused_by: z.string().optional(),
  blocks: z.array(z.string()).optional(), tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(registerTechDebt(ctx(project), args), null, 2) }] };
});

// --- 知识 ---

server.tool('record_knowledge', '记录项目知识', {
  project: projectParam,
  title: z.string(), description: z.string(), domain: z.string(), source: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  derived_from: z.array(z.string()).optional(), invalidates: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(recordKnowledge(ctx(project), args), null, 2) }] };
});

// --- 图操作 ---

server.tool('link_nodes', '建立节点间语义关系', {
  project: projectParam,
  source_id: z.string(), target_id: z.string(),
  relation: z.enum(['decomposes_into', 'spawns', 'produces', 'informs', 'creates', 'mitigates', 'addresses', 'blocks', 'relates_to', 'supersedes', 'evidenced_by', 'derived_from']),
  annotation: z.string().optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(linkNodes(ctx(project), args), null, 2) }] };
});

// --- 读操作 ---

server.tool('get_project_state', '获取项目认知状态快照', { project: projectParam }, async ({ project }) => {
  return { content: [{ type: 'text', text: JSON.stringify(getProjectState(ctx(project)), null, 2) }] };
});

server.tool('get_node_context', '获取节点完整上下文', {
  project: projectParam, node_id: z.string(), include_events: z.boolean().optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(getNodeContext(ctx(project), args.node_id, args.include_events ?? true), null, 2) }] };
});

server.tool('search_nodes', '全文搜索节点', { project: projectParam, query: z.string() }, async ({ project, query }) => {
  return { content: [{ type: 'text', text: JSON.stringify(ctx(project).nodes.search(query), null, 2) }] };
});

server.tool('get_roadmap', '获取目标路线图', {
  project: projectParam, root_goal: z.string().optional(), include_completed: z.boolean().optional(), max_depth: z.number().optional(),
}, async ({ project, ...args }) => {
  return { content: [{ type: 'text', text: JSON.stringify(getRoadmap(ctx(project), args), null, 2) }] };
});

server.tool('goal_progress', '获取活跃目标进度', { project: projectParam }, async ({ project }) => {
  return { content: [{ type: 'text', text: JSON.stringify(goalProgress(ctx(project)), null, 2) }] };
});

server.tool('decision_trail', '追溯决策链', { project: projectParam, node_id: z.string() }, async ({ project, node_id }) => {
  return { content: [{ type: 'text', text: JSON.stringify(decisionTrail(ctx(project), node_id), null, 2) }] };
});

server.tool('knowledge_map', '按领域查看知识图谱', { project: projectParam, domain: z.string().optional() }, async ({ project, domain }) => {
  return { content: [{ type: 'text', text: JSON.stringify(knowledgeMap(ctx(project), domain), null, 2) }] };
});

server.tool('stale_items', '查找过期节点', { project: projectParam, days: z.number().optional() }, async ({ project, days }) => {
  return { content: [{ type: 'text', text: JSON.stringify(staleItems(ctx(project), days), null, 2) }] };
});

server.tool('current_blockers', '查找阻塞项', { project: projectParam }, async ({ project }) => {
  return { content: [{ type: 'text', text: JSON.stringify(currentBlockers(ctx(project)), null, 2) }] };
});

server.tool('recent_activity', '获取最近事件', { project: projectParam, limit: z.number().optional() }, async ({ project, limit }) => {
  return { content: [{ type: 'text', text: JSON.stringify(recentActivity(ctx(project), limit), null, 2) }] };
});

server.tool('full_text_search', '全文搜索', { project: projectParam, query: z.string() }, async ({ project, query }) => {
  return { content: [{ type: 'text', text: JSON.stringify(fullTextSearch(ctx(project), query), null, 2) }] };
});

// ============================================================
// HTTP Server with Streamable HTTP Transport
// ============================================================

const MCP_PORT = Number(process.env.SI_BEAVER_MCP_PORT) || 7421;

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${MCP_PORT}`);

  if (url.pathname === '/mcp') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST' || req.method === 'GET') {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId && req.method === 'POST') {
        // New session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        await server.connect(transport);
        if (transport.sessionId) transports.set(transport.sessionId, transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid session' }));
        return;
      }

      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === 'DELETE') {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', projects: manager.listProjects().length }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

httpServer.listen(MCP_PORT, () => {
  console.log(`si-beaver MCP (Streamable HTTP) listening on http://0.0.0.0:${MCP_PORT}/mcp`);
});
