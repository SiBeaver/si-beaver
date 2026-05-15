/**
 * Shared MCP tool registration.
 * Registers all si-beaver tools onto a given McpServer instance.
 *
 * Two modes:
 * - "scoped": tools operate on a fixed project context (no project param exposed)
 * - "global": tools expose an optional project param (for stdio/multi-project clients)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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
import type { OperationContext } from '../operations/context.js';
import type { ProjectManager } from '../projects/index.js';
import { snakeToCamel } from '../api/transforms.js';

/** Wrap result: apply camelCase transform + JSON serialize for MCP text output */
function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(snakeToCamel(data), null, 2) }] };
}

/** Wrap a tool handler with timing + error logging */
function logged<A extends Record<string, unknown>>(
  label: string,
  toolName: string,
  handler: (args: A) => Promise<any>,
): (args: A) => Promise<any> {
  return async (args: A) => {
    const start = Date.now();
    try {
      const result = await handler(args);
      console.log(`[MCP] ${label} ${toolName} ${Date.now() - start}ms`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MCP] ${label} ${toolName} FAIL ${Date.now() - start}ms: ${msg}`);
      throw err;
    }
  };
}

// ============================================================
// Types
// ============================================================

export interface ScopedToolsOptions {
  mode: 'scoped';
  getContext: () => OperationContext;
  /** Expose project info tool showing current slug */
  slug: string;
}

export interface GlobalToolsOptions {
  mode: 'global';
  manager: ProjectManager;
}

export type RegisterToolsOptions = ScopedToolsOptions | GlobalToolsOptions;

// ============================================================
// Registration
// ============================================================

export function registerTools(server: McpServer, opts: RegisterToolsOptions): void {
  if (opts.mode === 'global') {
    registerGlobalTools(server, opts.manager);
  } else {
    registerScopedTools(server, opts.getContext, opts.slug);
  }
}

// ============================================================
// Scoped mode — tools bound to a single project
// ============================================================

function registerScopedTools(server: McpServer, getCtx: () => OperationContext, slug: string): void {
  const log = (name: string, handler: (args: any) => Promise<any>) => logged(slug, name, handler);

  // --- 项目信息 ---
  server.tool('get_project_info', '获取当前绑定的项目信息', {}, log('get_project_info', async () => {
    return jsonResult({ slug, message: `此连接绑定项目 "${slug}"` });
  }));

  // --- 目标 ---
  server.tool('define_goal', '定义一个项目目标', {
    title: z.string().describe('目标标题'),
    description: z.string().optional().describe('详细描述'),
    horizon: z.enum(['short', 'medium', 'long']).describe('时间范围'),
    success_criteria: z.array(z.string()).optional().describe('成功标准'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('优先级'),
    parent_goal: z.string().optional().describe('父目标 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('define_goal', async (args) => {
    return jsonResult(await defineGoal(getCtx(), args));
  }));

  server.tool('decompose_goal', '将目标分解为子目标、任务和需要的探索', {
    goal_id: z.string().describe('要分解的目标 ID'),
    sub_goals: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      horizon: z.enum(['short', 'medium', 'long']),
      success_criteria: z.array(z.string()).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    })).optional().describe('子目标列表'),
    tasks: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      acceptance_criteria: z.array(z.string()).optional(),
    })).optional().describe('任务列表'),
    explorations_needed: z.array(z.object({
      topic: z.string(), reason: z.string(), hypothesis: z.string().optional(),
    })).optional().describe('需要的探索'),
  }, log('decompose_goal', async (args) => {
    return jsonResult(await decomposeGoal(getCtx(), args));
  }));

  server.tool('update_goal_status', '更新目标状态', {
    goal_id: z.string().describe('目标 ID'),
    new_status: z.enum(['active', 'achieved', 'abandoned', 'deferred']).describe('新状态'),
    reason: z.string().describe('变更原因'),
  }, log('update_goal_status', async (args) => {
    return jsonResult(await updateGoalStatus(getCtx(), args));
  }));

  // --- 探索 ---
  server.tool('begin_exploration', '开始一个探索性调查', {
    topic: z.string().describe('探索主题'),
    hypothesis: z.string().optional().describe('假设'),
    reason: z.string().describe('为什么要探索'),
    approach: z.string().optional().describe('探索方法'),
    related_goals: z.array(z.string()).optional().describe('关联目标 ID'),
    triggered_by: z.string().optional().describe('触发此探索的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('begin_exploration', async (args) => {
    return jsonResult(await beginExploration(getCtx(), args));
  }));

  server.tool('record_exploration_finding', '记录探索过程中的发现', {
    exploration_id: z.string().describe('探索 ID'),
    finding: z.string().describe('发现内容'),
    significance: z.enum(['minor', 'major', 'breakthrough']).describe('重要程度'),
    related_nodes: z.array(z.string()).optional().describe('关联节点 ID'),
  }, log('record_exploration_finding', async (args) => {
    return jsonResult(await recordExplorationFinding(getCtx(), args));
  }));

  server.tool('conclude_exploration', '结论化探索，产出决策/知识/后续任务', {
    exploration_id: z.string().describe('探索 ID'),
    conclusion: z.string().describe('结论'),
    outcome: z.enum(['validated', 'invalidated', 'partial', 'inconclusive']).describe('结果类型'),
    decisions: z.array(z.object({
      title: z.string(), context: z.string().optional(),
      rationale: z.string(), consequences: z.array(z.string()).optional(),
    })).optional().describe('产出的决策'),
    knowledge: z.array(z.object({
      title: z.string(), domain: z.string(),
      description: z.string(), confidence: z.enum(['low', 'medium', 'high']).optional(),
    })).optional().describe('产出的知识'),
    follow_up_tasks: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
    })).optional().describe('后续任务'),
  }, log('conclude_exploration', async (args) => {
    return jsonResult(await concludeExploration(getCtx(), args));
  }));

  server.tool('abandon_exploration', '放弃探索', {
    exploration_id: z.string().describe('探索 ID'),
    reason: z.string().describe('放弃原因'),
    learnings: z.string().optional().describe('尽管失败但学到的东西'),
  }, log('abandon_exploration', async (args) => {
    return jsonResult(await abandonExploration(getCtx(), args));
  }));

  // --- 决策 ---
  server.tool('record_decision', '记录一个架构/设计决策', {
    title: z.string().describe('决策标题'),
    context: z.string().describe('促使决策的情境'),
    rationale: z.string().describe('为什么这样决定'),
    alternatives_considered: z.array(z.object({
      option: z.string(), pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(), reason_rejected: z.string(),
    })).optional().describe('考虑过的备选方案'),
    consequences: z.array(z.string()).optional().describe('接受的代价'),
    related_goals: z.array(z.string()).optional().describe('关联目标'),
    related_explorations: z.array(z.string()).optional().describe('关联探索'),
    supersedes: z.string().optional().describe('取代的旧决策 ID'),
    risks_created: z.array(z.object({
      title: z.string(), description: z.string(),
      likelihood: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high', 'critical']),
    })).optional().describe('此决策引入的风险'),
    tech_debt_created: z.array(z.object({
      title: z.string(), description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      affected_area: z.string(), cost_of_delay: z.string(),
    })).optional().describe('此决策引入的技术债'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('record_decision', async (args) => {
    return jsonResult(await recordDecision(getCtx(), args));
  }));

  // --- 任务 ---
  server.tool('create_task', '创建一个具体任务', {
    title: z.string().describe('任务标题'),
    description: z.string().optional().describe('描述'),
    effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional().describe('工作量'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('优先级'),
    acceptance_criteria: z.array(z.string()).optional().describe('验收标准'),
    parent_goal: z.string().optional().describe('所属目标 ID'),
    addresses_tech_debt: z.string().optional().describe('解决的技术债 ID'),
    mitigates_risk: z.string().optional().describe('缓解的风险 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('create_task', async (args) => {
    return jsonResult(await createTask(getCtx(), args));
  }));

  server.tool('update_task_status', '更新任务状态', {
    task_id: z.string().describe('任务 ID'),
    new_status: z.enum(['proposed', 'ready', 'in_progress', 'done', 'cancelled']).describe('新状态'),
    reason: z.string().optional().describe('变更原因'),
    artifacts: z.array(z.object({
      title: z.string(),
      artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']),
      uri: z.string().optional(), content_summary: z.string().optional(),
    })).optional().describe('完成时产出的产物'),
  }, log('update_task_status', async (args) => {
    return jsonResult(await updateTaskStatus(getCtx(), args));
  }));

  server.tool('backfill_task', '补录历史任务状态，允许跳过中间状态直接设为 done/cancelled', {
    task_id: z.string().describe('任务 ID'),
    new_status: z.enum(['done', 'cancelled']).describe('终态'),
    reason: z.string().optional().describe('变更原因'),
    artifacts: z.array(z.object({
      title: z.string(),
      artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']),
      uri: z.string().optional(), content_summary: z.string().optional(),
    })).optional().describe('完成时产出的产物'),
  }, log('backfill_task', async (args) => {
    return jsonResult(await backfillTask(getCtx(), args));
  }));

  // --- 风险与技术债 ---
  server.tool('identify_risk', '识别一个项目风险', {
    title: z.string().describe('风险标题'),
    description: z.string().describe('描述'),
    likelihood: z.enum(['low', 'medium', 'high']).describe('发生概率'),
    impact: z.enum(['low', 'medium', 'high', 'critical']).describe('影响程度'),
    trigger_conditions: z.array(z.string()).optional().describe('触发条件'),
    affected_goals: z.array(z.string()).optional().describe('受影响的目标 ID'),
    mitigation_strategy: z.string().optional().describe('缓解策略'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('identify_risk', async (args) => {
    return jsonResult(await identifyRisk(getCtx(), args));
  }));

  server.tool('update_risk', '更新风险状态或评估', {
    risk_id: z.string().describe('风险 ID'),
    new_status: z.enum(['identified', 'analyzing', 'mitigated', 'accepted', 'occurred', 'resolved']).optional(),
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    mitigation_strategy: z.string().optional(),
    reason: z.string().describe('更新原因'),
  }, log('update_risk', async (args) => {
    return jsonResult(await updateRisk(getCtx(), args));
  }));

  server.tool('register_tech_debt', '注册一项技术债', {
    title: z.string().describe('标题'),
    description: z.string().describe('描述'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('严重程度'),
    affected_area: z.string().describe('受影响区域'),
    cost_of_delay: z.string().describe('不处理的代价'),
    resolution_approach: z.string().optional().describe('解决方案'),
    caused_by: z.string().optional().describe('导致此债务的决策 ID'),
    blocks: z.array(z.string()).optional().describe('被此债务阻碍的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('register_tech_debt', async (args) => {
    return jsonResult(await registerTechDebt(getCtx(), args));
  }));

  // --- 知识 ---
  server.tool('record_knowledge', '记录一条项目知识', {
    title: z.string().describe('知识标题'),
    description: z.string().describe('知识内容'),
    domain: z.string().describe('所属领域'),
    confidence: z.enum(['low', 'medium', 'high']).optional().describe('确信程度'),
    source: z.string().describe('来源'),
    derived_from: z.array(z.string()).optional().describe('来源节点 ID'),
    invalidates: z.array(z.string()).optional().describe('被此知识取代的旧知识 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('record_knowledge', async (args) => {
    return jsonResult(await recordKnowledge(getCtx(), args));
  }));

  // --- 图操作 ---
  server.tool('link_nodes', '在两个节点之间建立语义关系', {
    source_id: z.string().describe('源节点 ID'),
    target_id: z.string().describe('目标节点 ID'),
    relation: z.enum([
      'decomposes_into', 'spawns', 'produces', 'informs', 'creates',
      'mitigates', 'addresses', 'blocks', 'relates_to', 'supersedes',
      'evidenced_by', 'derived_from',
    ]).describe('关系类型'),
    annotation: z.string().optional().describe('关系说明'),
  }, log('link_nodes', async (args) => {
    return jsonResult(await linkNodes(getCtx(), args));
  }));

  // --- 读操作 ---
  server.tool('get_project_state', '获取项目认知状态快照', {}, log('get_project_state', async () => {
    return jsonResult(await getProjectState(getCtx()));
  }));

  server.tool('get_node_context', '获取节点完整上下文', {
    node_id: z.string().describe('节点 ID'),
    include_events: z.boolean().optional().describe('是否包含事件历史'),
  }, log('get_node_context', async (args) => {
    return jsonResult(await getNodeContext(getCtx(), args.node_id, args.include_events ?? true));
  }));

  server.tool('get_task_context', '获取任务执行上下文（含父目标、关联决策、知识、风险）', {
    task_id: z.string().describe('任务 ID'),
  }, log('get_task_context', async (args) => {
    return jsonResult(await getTaskContext(getCtx(), args.task_id));
  }));

  server.tool('search_nodes', '全文搜索节点', {
    query: z.string().describe('搜索关键词'),
  }, log('search_nodes', async (args) => {
    return jsonResult(await getCtx().nodes.search(args.query));
  }));

  server.tool('get_roadmap', '获取目标路线图', {
    root_goal: z.string().optional().describe('根目标 ID'),
    include_completed: z.boolean().optional().describe('是否包含已完成的目标'),
    max_depth: z.number().optional().describe('最大展开深度'),
  }, log('get_roadmap', async (args) => {
    return jsonResult(await getRoadmap(getCtx(), args));
  }));

  server.tool('goal_progress', '获取活跃目标进度', {}, log('goal_progress', async () => {
    return jsonResult(await goalProgress(getCtx()));
  }));

  server.tool('decision_trail', '追溯决策链', {
    node_id: z.string().describe('起始节点 ID'),
  }, log('decision_trail', async (args) => {
    return jsonResult(await decisionTrail(getCtx(), args.node_id));
  }));

  server.tool('knowledge_map', '按领域查看知识图谱', {
    domain: z.string().optional().describe('过滤领域'),
  }, log('knowledge_map', async (args) => {
    return jsonResult(await knowledgeMap(getCtx(), args.domain));
  }));

  server.tool('stale_items', '查找长时间未更新的活跃节点', {
    days: z.number().optional().describe('超过多少天视为过期，默认 7'),
  }, log('stale_items', async (args) => {
    return jsonResult(await staleItems(getCtx(), args.days));
  }));

  server.tool('current_blockers', '查找阻塞项', {}, log('current_blockers', async () => {
    return jsonResult(await currentBlockers(getCtx()));
  }));

  server.tool('recent_activity', '获取最近事件', {
    limit: z.number().optional().describe('返回事件数量，默认 20'),
  }, log('recent_activity', async (args) => {
    return jsonResult(await recentActivity(getCtx(), args.limit));
  }));

  server.tool('full_text_search', '全文搜索所有节点', {
    query: z.string().describe('搜索关键词'),
  }, log('full_text_search', async (args) => {
    return jsonResult(await fullTextSearch(getCtx(), args.query));
  }));
}

// ============================================================
// Global mode — tools with optional project param (for stdio)
// ============================================================

function registerGlobalTools(server: McpServer, manager: ProjectManager): void {
  const projectParam = z.string().optional().describe('项目 slug（默认使用当前默认项目）');
  const log = (name: string, handler: (args: any) => Promise<any>) => logged('global', name, handler);

  async function ctx(project?: string) {
    const slug = project ?? await manager.getDefaultProject();
    return manager.getContext(slug);
  }

  // --- 项目管理 ---
  server.tool('list_projects', '列出所有项目', {}, log('list_projects', async () => {
    return jsonResult(await manager.listProjects());
  }));

  server.tool('create_project', '创建一个新项目', {
    slug: z.string().describe('项目标识符'),
    name: z.string().describe('项目显示名称'),
    description: z.string().optional().describe('项目描述'),
  }, log('create_project', async (args) => {
    return jsonResult(await manager.createProject(args));
  }));

  server.tool('set_default_project', '设置默认项目', {
    slug: z.string().describe('项目 slug'),
  }, log('set_default_project', async (args) => {
    await manager.setDefaultProject(args.slug);
    return { content: [{ type: 'text', text: `Default project set to "${args.slug}"` }] };
  }));

  server.tool('get_current_project', '获取当前默认项目', {}, log('get_current_project', async () => {
    const slug = await manager.getDefaultProject();
    const project = await manager.getProject(slug);
    return jsonResult({ slug, project });
  }));

  // --- 目标 ---
  server.tool('define_goal', '定义一个项目目标', {
    project: projectParam,
    title: z.string().describe('目标标题'),
    description: z.string().optional().describe('详细描述'),
    horizon: z.enum(['short', 'medium', 'long']).describe('时间范围'),
    success_criteria: z.array(z.string()).optional().describe('成功标准'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('优先级'),
    parent_goal: z.string().optional().describe('父目标 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('define_goal', async ({ project, ...args }) => {
    return jsonResult(await defineGoal(await ctx(project), args));
  }));

  server.tool('decompose_goal', '将目标分解为子目标、任务和需要的探索', {
    project: projectParam,
    goal_id: z.string().describe('要分解的目标 ID'),
    sub_goals: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      horizon: z.enum(['short', 'medium', 'long']),
      success_criteria: z.array(z.string()).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    })).optional().describe('子目标列表'),
    tasks: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      acceptance_criteria: z.array(z.string()).optional(),
    })).optional().describe('任务列表'),
    explorations_needed: z.array(z.object({
      topic: z.string(), reason: z.string(), hypothesis: z.string().optional(),
    })).optional().describe('需要的探索'),
  }, log('decompose_goal', async ({ project, ...args }) => {
    return jsonResult(await decomposeGoal(await ctx(project), args));
  }));

  server.tool('update_goal_status', '更新目标状态', {
    project: projectParam,
    goal_id: z.string().describe('目标 ID'),
    new_status: z.enum(['active', 'achieved', 'abandoned', 'deferred']).describe('新状态'),
    reason: z.string().describe('变更原因'),
  }, log('update_goal_status', async ({ project, ...args }) => {
    return jsonResult(await updateGoalStatus(await ctx(project), args));
  }));

  // --- 探索 ---
  server.tool('begin_exploration', '开始一个探索性调查', {
    project: projectParam,
    topic: z.string().describe('探索主题'),
    hypothesis: z.string().optional().describe('假设'),
    reason: z.string().describe('为什么要探索'),
    approach: z.string().optional().describe('探索方法'),
    related_goals: z.array(z.string()).optional().describe('关联目标 ID'),
    triggered_by: z.string().optional().describe('触发此探索的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  }, log('begin_exploration', async ({ project, ...args }) => {
    return jsonResult(await beginExploration(await ctx(project), args));
  }));

  server.tool('record_exploration_finding', '记录探索过程中的发现', {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    finding: z.string().describe('发现内容'),
    significance: z.enum(['minor', 'major', 'breakthrough']).describe('重要程度'),
    related_nodes: z.array(z.string()).optional().describe('关联节点 ID'),
  }, log('record_exploration_finding', async ({ project, ...args }) => {
    return jsonResult(await recordExplorationFinding(await ctx(project), args));
  }));

  server.tool('conclude_exploration', '结论化探索', {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    conclusion: z.string().describe('结论'),
    outcome: z.enum(['validated', 'invalidated', 'partial', 'inconclusive']).describe('结果类型'),
    decisions: z.array(z.object({
      title: z.string(), context: z.string().optional(),
      rationale: z.string(), consequences: z.array(z.string()).optional(),
    })).optional().describe('产出的决策'),
    knowledge: z.array(z.object({
      title: z.string(), domain: z.string(),
      description: z.string(), confidence: z.enum(['low', 'medium', 'high']).optional(),
    })).optional().describe('产出的知识'),
    follow_up_tasks: z.array(z.object({
      title: z.string(), description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
    })).optional().describe('后续任务'),
  }, log('conclude_exploration', async ({ project, ...args }) => {
    return jsonResult(await concludeExploration(await ctx(project), args));
  }));

  server.tool('abandon_exploration', '放弃探索', {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    reason: z.string().describe('放弃原因'),
    learnings: z.string().optional().describe('学到的东西'),
  }, log('abandon_exploration', async ({ project, ...args }) => {
    return jsonResult(await abandonExploration(await ctx(project), args));
  }));

  // --- 决策 ---
  server.tool('record_decision', '记录架构/设计决策', {
    project: projectParam,
    title: z.string().describe('决策标题'),
    context: z.string().describe('情境'),
    rationale: z.string().describe('理由'),
    alternatives_considered: z.array(z.object({
      option: z.string(), pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(), reason_rejected: z.string(),
    })).optional().describe('备选方案'),
    consequences: z.array(z.string()).optional().describe('代价'),
    related_goals: z.array(z.string()).optional(),
    related_explorations: z.array(z.string()).optional(),
    supersedes: z.string().optional(),
    risks_created: z.array(z.object({
      title: z.string(), description: z.string(),
      likelihood: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high', 'critical']),
    })).optional(),
    tech_debt_created: z.array(z.object({
      title: z.string(), description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      affected_area: z.string(), cost_of_delay: z.string(),
    })).optional(),
    tags: z.array(z.string()).optional(),
  }, log('record_decision', async ({ project, ...args }) => {
    return jsonResult(await recordDecision(await ctx(project), args));
  }));

  // --- 任务 ---
  server.tool('create_task', '创建任务', {
    project: projectParam,
    title: z.string().describe('任务标题'),
    description: z.string().optional(),
    effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    acceptance_criteria: z.array(z.string()).optional(),
    parent_goal: z.string().optional(),
    addresses_tech_debt: z.string().optional(),
    mitigates_risk: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }, log('create_task', async ({ project, ...args }) => {
    return jsonResult(await createTask(await ctx(project), args));
  }));

  server.tool('update_task_status', '更新任务状态', {
    project: projectParam,
    task_id: z.string().describe('任务 ID'),
    new_status: z.enum(['proposed', 'ready', 'in_progress', 'done', 'cancelled']).describe('新状态'),
    reason: z.string().optional(),
    artifacts: z.array(z.object({
      title: z.string(),
      artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']),
      uri: z.string().optional(), content_summary: z.string().optional(),
    })).optional(),
  }, log('update_task_status', async ({ project, ...args }) => {
    return jsonResult(await updateTaskStatus(await ctx(project), args));
  }));

  server.tool('backfill_task', '补录历史任务状态，跳过中间状态', {
    project: projectParam,
    task_id: z.string().describe('任务 ID'),
    new_status: z.enum(['done', 'cancelled']).describe('终态'),
    reason: z.string().optional(),
    artifacts: z.array(z.object({
      title: z.string(),
      artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']),
      uri: z.string().optional(), content_summary: z.string().optional(),
    })).optional(),
  }, log('backfill_task', async ({ project, ...args }) => {
    return jsonResult(await backfillTask(await ctx(project), args));
  }));

  // --- 风险与技术债 ---
  server.tool('identify_risk', '识别风险', {
    project: projectParam,
    title: z.string(), description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high', 'critical']),
    trigger_conditions: z.array(z.string()).optional(),
    affected_goals: z.array(z.string()).optional(),
    mitigation_strategy: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }, log('identify_risk', async ({ project, ...args }) => {
    return jsonResult(await identifyRisk(await ctx(project), args));
  }));

  server.tool('update_risk', '更新风险', {
    project: projectParam,
    risk_id: z.string(), reason: z.string(),
    new_status: z.enum(['identified', 'analyzing', 'mitigated', 'accepted', 'occurred', 'resolved']).optional(),
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    mitigation_strategy: z.string().optional(),
  }, log('update_risk', async ({ project, ...args }) => {
    return jsonResult(await updateRisk(await ctx(project), args));
  }));

  server.tool('register_tech_debt', '注册技术债', {
    project: projectParam,
    title: z.string(), description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    affected_area: z.string(), cost_of_delay: z.string(),
    resolution_approach: z.string().optional(),
    caused_by: z.string().optional(),
    blocks: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }, log('register_tech_debt', async ({ project, ...args }) => {
    return jsonResult(await registerTechDebt(await ctx(project), args));
  }));

  // --- 知识 ---
  server.tool('record_knowledge', '记录知识', {
    project: projectParam,
    title: z.string(), description: z.string(),
    domain: z.string(), source: z.string(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    derived_from: z.array(z.string()).optional(),
    invalidates: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }, log('record_knowledge', async ({ project, ...args }) => {
    return jsonResult(await recordKnowledge(await ctx(project), args));
  }));

  // --- 图操作 ---
  server.tool('link_nodes', '建立节点间关系', {
    project: projectParam,
    source_id: z.string(), target_id: z.string(),
    relation: z.enum([
      'decomposes_into', 'spawns', 'produces', 'informs', 'creates',
      'mitigates', 'addresses', 'blocks', 'relates_to', 'supersedes',
      'evidenced_by', 'derived_from',
    ]),
    annotation: z.string().optional(),
  }, log('link_nodes', async ({ project, ...args }) => {
    return jsonResult(await linkNodes(await ctx(project), args));
  }));

  // --- 读操作 ---
  server.tool('get_project_state', '获取项目认知状态快照', { project: projectParam }, log('get_project_state', async ({ project }) => {
    return jsonResult(await getProjectState(await ctx(project)));
  }));

  server.tool('get_node_context', '获取节点完整上下文', {
    project: projectParam, node_id: z.string(),
    include_events: z.boolean().optional(),
  }, log('get_node_context', async ({ project, ...args }) => {
    return jsonResult(await getNodeContext(await ctx(project), args.node_id, args.include_events ?? true));
  }));

  server.tool('get_task_context', '获取任务执行上下文（含父目标、关联决策、知识、风险）', {
    project: projectParam, task_id: z.string().describe('任务 ID'),
  }, log('get_task_context', async ({ project, ...args }) => {
    return jsonResult(await getTaskContext(await ctx(project), args.task_id));
  }));

  server.tool('search_nodes', '全文搜索节点', { project: projectParam, query: z.string() }, log('search_nodes', async ({ project, query }) => {
    return jsonResult(await (await ctx(project)).nodes.search(query));
  }));

  server.tool('get_roadmap', '获取路线图', {
    project: projectParam, root_goal: z.string().optional(),
    include_completed: z.boolean().optional(), max_depth: z.number().optional(),
  }, log('get_roadmap', async ({ project, ...args }) => {
    return jsonResult(await getRoadmap(await ctx(project), args));
  }));

  server.tool('goal_progress', '获取目标进度', { project: projectParam }, log('goal_progress', async ({ project }) => {
    return jsonResult(await goalProgress(await ctx(project)));
  }));

  server.tool('decision_trail', '追溯决策链', { project: projectParam, node_id: z.string() }, log('decision_trail', async ({ project, node_id }) => {
    return jsonResult(await decisionTrail(await ctx(project), node_id));
  }));

  server.tool('knowledge_map', '查看知识图谱', { project: projectParam, domain: z.string().optional() }, log('knowledge_map', async ({ project, domain }) => {
    return jsonResult(await knowledgeMap(await ctx(project), domain));
  }));

  server.tool('stale_items', '查找过期节点', { project: projectParam, days: z.number().optional() }, log('stale_items', async ({ project, days }) => {
    return jsonResult(await staleItems(await ctx(project), days));
  }));

  server.tool('current_blockers', '查找阻塞项', { project: projectParam }, log('current_blockers', async ({ project }) => {
    return jsonResult(await currentBlockers(await ctx(project)));
  }));

  server.tool('recent_activity', '获取最近事件', { project: projectParam, limit: z.number().optional() }, log('recent_activity', async ({ project, limit }) => {
    return jsonResult(await recentActivity(await ctx(project), limit));
  }));

  server.tool('full_text_search', '全文搜索', { project: projectParam, query: z.string() }, log('full_text_search', async ({ project, query }) => {
    return jsonResult(await fullTextSearch(await ctx(project), query));
  }));
}
