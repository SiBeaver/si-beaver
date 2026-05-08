import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

const server = new McpServer({
  name: 'si-beaver',
  version: '0.2.0',
});

/** Helper: resolve project context from optional project param */
function ctx(project?: string) {
  return manager.getContext(project ?? manager.getDefaultProject());
}

/** Common project param schema added to all tools */
const projectParam = z.string().optional().describe('项目 slug（默认使用当前默认项目）');

// ============================================================
// Tools — 项目管理
// ============================================================

server.tool(
  'list_projects',
  '列出所有项目',
  {},
  async () => {
    const result = manager.listProjects();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'create_project',
  '创建一个新项目',
  {
    slug: z.string().describe('项目标识符（小写字母+数字+连字符，如 "my-app"）'),
    name: z.string().describe('项目显示名称'),
    description: z.string().optional().describe('项目描述'),
  },
  async (args) => {
    const result = manager.createProject(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'set_default_project',
  '设置默认项目',
  {
    slug: z.string().describe('项目 slug'),
  },
  async (args) => {
    manager.setDefaultProject(args.slug);
    return { content: [{ type: 'text', text: `Default project set to "${args.slug}"` }] };
  }
);

server.tool(
  'get_current_project',
  '获取当前默认项目',
  {},
  async () => {
    const slug = manager.getDefaultProject();
    const project = manager.getProject(slug);
    return { content: [{ type: 'text', text: JSON.stringify({ slug, project }, null, 2) }] };
  }
);

// ============================================================
// Tools — 变更操作
// ============================================================

// --- 目标操作 ---

server.tool(
  'define_goal',
  '定义一个项目目标',
  {
    project: projectParam,
    title: z.string().describe('目标标题'),
    description: z.string().optional().describe('详细描述'),
    horizon: z.enum(['short', 'medium', 'long']).describe('时间范围'),
    success_criteria: z.array(z.string()).optional().describe('成功标准'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('优先级'),
    parent_goal: z.string().optional().describe('父目标 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = defineGoal(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'decompose_goal',
  '将目标分解为子目标、任务和需要的探索',
  {
    project: projectParam,
    goal_id: z.string().describe('要分解的目标 ID'),
    sub_goals: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      horizon: z.enum(['short', 'medium', 'long']),
      success_criteria: z.array(z.string()).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    })).optional().describe('子目标列表'),
    tasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      acceptance_criteria: z.array(z.string()).optional(),
    })).optional().describe('任务列表'),
    explorations_needed: z.array(z.object({
      topic: z.string(),
      reason: z.string(),
      hypothesis: z.string().optional(),
    })).optional().describe('需要的探索'),
  },
  async ({ project, ...args }) => {
    const result = decomposeGoal(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_goal_status',
  '更新目标状态',
  {
    project: projectParam,
    goal_id: z.string().describe('目标 ID'),
    new_status: z.enum(['active', 'achieved', 'abandoned', 'deferred']).describe('新状态'),
    reason: z.string().describe('变更原因'),
  },
  async ({ project, ...args }) => {
    const result = updateGoalStatus(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 探索操作 ---

server.tool(
  'begin_exploration',
  '开始一个探索性调查（研究未知问题）',
  {
    project: projectParam,
    topic: z.string().describe('探索主题'),
    hypothesis: z.string().optional().describe('假设'),
    reason: z.string().describe('为什么要探索'),
    approach: z.string().optional().describe('探索方法'),
    related_goals: z.array(z.string()).optional().describe('关联目标 ID'),
    triggered_by: z.string().optional().describe('触发此探索的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = beginExploration(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'record_exploration_finding',
  '记录探索过程中的发现',
  {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    finding: z.string().describe('发现内容'),
    significance: z.enum(['minor', 'major', 'breakthrough']).describe('重要程度'),
    related_nodes: z.array(z.string()).optional().describe('关联节点 ID'),
  },
  async ({ project, ...args }) => {
    const result = recordExplorationFinding(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'conclude_exploration',
  '结论化探索，产出决策/知识/后续任务',
  {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    conclusion: z.string().describe('结论'),
    outcome: z.enum(['validated', 'invalidated', 'partial', 'inconclusive']).describe('结果类型'),
    decisions: z.array(z.object({
      title: z.string(),
      context: z.string().optional(),
      rationale: z.string(),
      consequences: z.array(z.string()).optional(),
    })).optional().describe('产出的决策'),
    knowledge: z.array(z.object({
      title: z.string(),
      domain: z.string(),
      description: z.string(),
      confidence: z.enum(['low', 'medium', 'high']).optional(),
    })).optional().describe('产出的知识'),
    follow_up_tasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional(),
    })).optional().describe('后续任务'),
  },
  async ({ project, ...args }) => {
    const result = concludeExploration(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'abandon_exploration',
  '放弃探索（记录原因和可能的学习）',
  {
    project: projectParam,
    exploration_id: z.string().describe('探索 ID'),
    reason: z.string().describe('放弃原因'),
    learnings: z.string().optional().describe('尽管失败但学到的东西'),
  },
  async ({ project, ...args }) => {
    const result = abandonExploration(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 决策操作 ---

server.tool(
  'record_decision',
  '记录一个架构/设计决策（含理由和备选方案）',
  {
    project: projectParam,
    title: z.string().describe('决策标题'),
    context: z.string().describe('促使决策的情境'),
    rationale: z.string().describe('为什么这样决定'),
    alternatives_considered: z.array(z.object({
      option: z.string(),
      pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(),
      reason_rejected: z.string(),
    })).optional().describe('考虑过的备选方案'),
    consequences: z.array(z.string()).optional().describe('接受的代价'),
    related_goals: z.array(z.string()).optional().describe('关联目标'),
    related_explorations: z.array(z.string()).optional().describe('关联探索'),
    supersedes: z.string().optional().describe('取代的旧决策 ID'),
    risks_created: z.array(z.object({
      title: z.string(),
      description: z.string(),
      likelihood: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high', 'critical']),
    })).optional().describe('此决策引入的风险'),
    tech_debt_created: z.array(z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      affected_area: z.string(),
      cost_of_delay: z.string(),
    })).optional().describe('此决策引入的技术债'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = recordDecision(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 任务操作 ---

server.tool(
  'create_task',
  '创建一个具体任务',
  {
    project: projectParam,
    title: z.string().describe('任务标题'),
    description: z.string().optional().describe('描述'),
    effort: z.enum(['trivial', 'small', 'medium', 'large', 'unknown']).optional().describe('工作量'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('优先级'),
    acceptance_criteria: z.array(z.string()).optional().describe('验收标准'),
    parent_goal: z.string().optional().describe('所属目标 ID'),
    addresses_tech_debt: z.string().optional().describe('解决的技术债 ID'),
    mitigates_risk: z.string().optional().describe('缓解的风险 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = createTask(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_task_status',
  '更新任务状态',
  {
    project: projectParam,
    task_id: z.string().describe('任务 ID'),
    new_status: z.enum(['proposed', 'ready', 'in_progress', 'done', 'cancelled']).describe('新状态'),
    reason: z.string().optional().describe('变更原因'),
    artifacts: z.array(z.object({
      title: z.string(),
      artifact_type: z.enum(['document', 'design', 'pr', 'commit', 'prototype', 'spec', 'other']),
      uri: z.string().optional(),
      content_summary: z.string().optional(),
    })).optional().describe('完成时产出的产物'),
  },
  async ({ project, ...args }) => {
    const result = updateTaskStatus(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 风险与技术债 ---

server.tool(
  'identify_risk',
  '识别一个项目风险',
  {
    project: projectParam,
    title: z.string().describe('风险标题'),
    description: z.string().describe('描述'),
    likelihood: z.enum(['low', 'medium', 'high']).describe('发生概率'),
    impact: z.enum(['low', 'medium', 'high', 'critical']).describe('影响程度'),
    trigger_conditions: z.array(z.string()).optional().describe('触发条件'),
    affected_goals: z.array(z.string()).optional().describe('受影响的目标 ID'),
    mitigation_strategy: z.string().optional().describe('缓解策略'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = identifyRisk(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_risk',
  '更新风险状态或评估',
  {
    project: projectParam,
    risk_id: z.string().describe('风险 ID'),
    new_status: z.enum(['identified', 'analyzing', 'mitigated', 'accepted', 'occurred', 'resolved']).optional(),
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    mitigation_strategy: z.string().optional(),
    reason: z.string().describe('更新原因'),
  },
  async ({ project, ...args }) => {
    const result = updateRisk(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'register_tech_debt',
  '注册一项技术债',
  {
    project: projectParam,
    title: z.string().describe('标题'),
    description: z.string().describe('描述'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('严重程度'),
    affected_area: z.string().describe('受影响区域'),
    cost_of_delay: z.string().describe('不处理的代价'),
    resolution_approach: z.string().optional().describe('解决方案'),
    caused_by: z.string().optional().describe('导致此债务的决策 ID'),
    blocks: z.array(z.string()).optional().describe('被此债务阻碍的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = registerTechDebt(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 知识操作 ---

server.tool(
  'record_knowledge',
  '记录一条项目知识（结晶化的理解）',
  {
    project: projectParam,
    title: z.string().describe('知识标题'),
    description: z.string().describe('知识内容'),
    domain: z.string().describe('所属领域'),
    confidence: z.enum(['low', 'medium', 'high']).optional().describe('确信程度'),
    source: z.string().describe('来源'),
    derived_from: z.array(z.string()).optional().describe('来源节点 ID'),
    invalidates: z.array(z.string()).optional().describe('被此知识取代的旧知识 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async ({ project, ...args }) => {
    const result = recordKnowledge(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 图操作 ---

server.tool(
  'link_nodes',
  '在两个节点之间建立语义关系',
  {
    project: projectParam,
    source_id: z.string().describe('源节点 ID'),
    target_id: z.string().describe('目标节点 ID'),
    relation: z.enum([
      'decomposes_into', 'spawns', 'produces', 'informs', 'creates',
      'mitigates', 'addresses', 'blocks', 'relates_to', 'supersedes',
      'evidenced_by', 'derived_from',
    ]).describe('关系类型'),
    annotation: z.string().optional().describe('关系说明'),
  },
  async ({ project, ...args }) => {
    const result = linkNodes(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 读操作 ---

server.tool(
  'get_project_state',
  '获取项目当前认知状态的全局快照（目标、探索、决策、风险、技术债等）',
  {
    project: projectParam,
  },
  async ({ project }) => {
    const result = getProjectState(ctx(project));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_node_context',
  '获取一个节点的完整上下文（关联节点、边、事件历史）',
  {
    project: projectParam,
    node_id: z.string().describe('节点 ID'),
    include_events: z.boolean().optional().describe('是否包含事件历史'),
  },
  async ({ project, ...args }) => {
    const result = getNodeContext(ctx(project), args.node_id, args.include_events ?? true);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'search_nodes',
  '全文搜索节点',
  {
    project: projectParam,
    query: z.string().describe('搜索关键词'),
  },
  async ({ project, ...args }) => {
    const results = ctx(project).nodes.search(args.query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

// --- 查询操作 ---

server.tool(
  'get_roadmap',
  '获取目标路线图（树状结构，含进度）',
  {
    project: projectParam,
    root_goal: z.string().optional().describe('根目标 ID，不指定则返回所有顶层目标'),
    include_completed: z.boolean().optional().describe('是否包含已完成的目标'),
    max_depth: z.number().optional().describe('最大展开深度'),
  },
  async ({ project, ...args }) => {
    const result = getRoadmap(ctx(project), args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'goal_progress',
  '获取所有活跃目标的子项完成进度',
  {
    project: projectParam,
  },
  async ({ project }) => {
    const result = goalProgress(ctx(project));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'decision_trail',
  '追溯决策/探索链 — 回答「为什么做了某个决策」',
  {
    project: projectParam,
    node_id: z.string().describe('起始节点 ID'),
  },
  async ({ project, ...args }) => {
    const result = decisionTrail(ctx(project), args.node_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'knowledge_map',
  '按领域查看知识图谱',
  {
    project: projectParam,
    domain: z.string().optional().describe('过滤领域，不指定则返回全部'),
  },
  async ({ project, ...args }) => {
    const result = knowledgeMap(ctx(project), args.domain);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'stale_items',
  '查找长时间未更新的活跃节点',
  {
    project: projectParam,
    days: z.number().optional().describe('超过多少天未更新视为过期，默认 7'),
  },
  async ({ project, ...args }) => {
    const result = staleItems(ctx(project), args.days);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'current_blockers',
  '查找阻塞活跃目标/任务的风险和技术债',
  {
    project: projectParam,
  },
  async ({ project }) => {
    const result = currentBlockers(ctx(project));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'recent_activity',
  '获取最近的项目事件',
  {
    project: projectParam,
    limit: z.number().optional().describe('返回事件数量，默认 20'),
  },
  async ({ project, ...args }) => {
    const result = recentActivity(ctx(project), args.limit);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'full_text_search',
  '全文搜索所有节点（标题和描述）',
  {
    project: projectParam,
    query: z.string().describe('搜索关键词'),
  },
  async ({ project, ...args }) => {
    const result = fullTextSearch(ctx(project), args.query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ============================================================
// 启动
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('si-beaver MCP server started (multi-project)');
}

main().catch(console.error);
