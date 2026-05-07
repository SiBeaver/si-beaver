import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
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
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
} from '../operations/index.js';

// ============================================================
// 初始化
// ============================================================

const DB_PATH = process.env.SI_BEAVER_DB
  ?? resolve(homedir(), '.si-beaver', 'projects', 'default', 'cognition.db');

const db = openDatabase(DB_PATH);
const ctx = new OperationContext(db);

const server = new McpServer({
  name: 'si-beaver',
  version: '0.1.0',
});

// ============================================================
// Tools — 变更操作
// ============================================================

// --- 目标操作 ---

server.tool(
  'define_goal',
  '定义一个项目目标',
  {
    title: z.string().describe('目标标题'),
    description: z.string().optional().describe('详细描述'),
    horizon: z.enum(['short', 'medium', 'long']).describe('时间范围'),
    success_criteria: z.array(z.string()).optional().describe('成功标准'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('优先级'),
    parent_goal: z.string().optional().describe('父目标 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async (args) => {
    const result = defineGoal(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'decompose_goal',
  '将目标分解为子目标、任务和需要的探索',
  {
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
  async (args) => {
    const result = decomposeGoal(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_goal_status',
  '更新目标状态',
  {
    goal_id: z.string().describe('目标 ID'),
    new_status: z.enum(['active', 'achieved', 'abandoned', 'deferred']).describe('新状态'),
    reason: z.string().describe('变更原因'),
  },
  async (args) => {
    const result = updateGoalStatus(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 探索操作 ---

server.tool(
  'begin_exploration',
  '开始一个探索性调查（研究未知问题）',
  {
    topic: z.string().describe('探索主题'),
    hypothesis: z.string().optional().describe('假设'),
    reason: z.string().describe('为什么要探索'),
    approach: z.string().optional().describe('探索方法'),
    related_goals: z.array(z.string()).optional().describe('关联目标 ID'),
    triggered_by: z.string().optional().describe('触发此探索的节点 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async (args) => {
    const result = beginExploration(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'record_exploration_finding',
  '记录探索过程中的发现',
  {
    exploration_id: z.string().describe('探索 ID'),
    finding: z.string().describe('发现内容'),
    significance: z.enum(['minor', 'major', 'breakthrough']).describe('重要程度'),
    related_nodes: z.array(z.string()).optional().describe('关联节点 ID'),
  },
  async (args) => {
    const result = recordExplorationFinding(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'conclude_exploration',
  '结论化探索，产出决策/知识/后续任务',
  {
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
  async (args) => {
    const result = concludeExploration(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'abandon_exploration',
  '放弃探索（记录原因和可能的学习）',
  {
    exploration_id: z.string().describe('探索 ID'),
    reason: z.string().describe('放弃原因'),
    learnings: z.string().optional().describe('尽管失败但学到的东西'),
  },
  async (args) => {
    const result = abandonExploration(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 决策操作 ---

server.tool(
  'record_decision',
  '记录一个架构/设计决策（含理由和备选方案）',
  {
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
  async (args) => {
    const result = recordDecision(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 任务操作 ---

server.tool(
  'create_task',
  '创建一个具体任务',
  {
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
  async (args) => {
    const result = createTask(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_task_status',
  '更新任务状态',
  {
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
  async (args) => {
    const result = updateTaskStatus(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 风险与技术债 ---

server.tool(
  'identify_risk',
  '识别一个项目风险',
  {
    title: z.string().describe('风险标题'),
    description: z.string().describe('描述'),
    likelihood: z.enum(['low', 'medium', 'high']).describe('发生概率'),
    impact: z.enum(['low', 'medium', 'high', 'critical']).describe('影响程度'),
    trigger_conditions: z.array(z.string()).optional().describe('触发条件'),
    affected_goals: z.array(z.string()).optional().describe('受影响的目标 ID'),
    mitigation_strategy: z.string().optional().describe('缓解策略'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async (args) => {
    const result = identifyRisk(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'update_risk',
  '更新风险状态或评估',
  {
    risk_id: z.string().describe('风险 ID'),
    new_status: z.enum(['identified', 'analyzing', 'mitigated', 'accepted', 'occurred', 'resolved']).optional(),
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    mitigation_strategy: z.string().optional(),
    reason: z.string().describe('更新原因'),
  },
  async (args) => {
    const result = updateRisk(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'register_tech_debt',
  '注册一项技术债',
  {
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
  async (args) => {
    const result = registerTechDebt(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 知识操作 ---

server.tool(
  'record_knowledge',
  '记录一条项目知识（结晶化的理解）',
  {
    title: z.string().describe('知识标题'),
    description: z.string().describe('知识内容'),
    domain: z.string().describe('所属领域'),
    confidence: z.enum(['low', 'medium', 'high']).optional().describe('确信程度'),
    source: z.string().describe('来源'),
    derived_from: z.array(z.string()).optional().describe('来源节点 ID'),
    invalidates: z.array(z.string()).optional().describe('被此知识取代的旧知识 ID'),
    tags: z.array(z.string()).optional().describe('标签'),
  },
  async (args) => {
    const result = recordKnowledge(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 图操作 ---

server.tool(
  'link_nodes',
  '在两个节点之间建立语义关系',
  {
    source_id: z.string().describe('源节点 ID'),
    target_id: z.string().describe('目标节点 ID'),
    relation: z.enum([
      'decomposes_into', 'spawns', 'produces', 'informs', 'creates',
      'mitigates', 'addresses', 'blocks', 'relates_to', 'supersedes',
      'evidenced_by', 'derived_from',
    ]).describe('关系类型'),
    annotation: z.string().optional().describe('关系说明'),
  },
  async (args) => {
    const result = linkNodes(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- 读操作（也作为 tool 暴露，方便 AI 调用） ---

server.tool(
  'get_project_state',
  '获取项目当前认知状态的全局快照（目标、探索、决策、风险、技术债等）',
  {},
  async () => {
    const result = getProjectState(ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_node_context',
  '获取一个节点的完整上下文（关联节点、边、事件历史）',
  {
    node_id: z.string().describe('节点 ID'),
    include_events: z.boolean().optional().describe('是否包含事件历史'),
  },
  async (args) => {
    const result = getNodeContext(ctx, args.node_id, args.include_events ?? true);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'search_nodes',
  '全文搜索节点',
  {
    query: z.string().describe('搜索关键词'),
  },
  async (args) => {
    const results = ctx.nodes.search(args.query);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

// --- 查询操作 ---

server.tool(
  'get_roadmap',
  '获取目标路线图（树状结构，含进度）',
  {
    root_goal: z.string().optional().describe('根目标 ID，不指定则返回所有顶层目标'),
    include_completed: z.boolean().optional().describe('是否包含已完成的目标'),
    max_depth: z.number().optional().describe('最大展开深度'),
  },
  async (args) => {
    const result = getRoadmap(ctx, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'goal_progress',
  '获取所有活跃目标的子项完成进度',
  {},
  async () => {
    const result = goalProgress(ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'decision_trail',
  '追溯决策/探索链 — 回答「为什么做了某个决策」',
  {
    node_id: z.string().describe('起始节点 ID'),
  },
  async (args) => {
    const result = decisionTrail(ctx, args.node_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'knowledge_map',
  '按领域查看知识图谱',
  {
    domain: z.string().optional().describe('过滤领域，不指定则返回全部'),
  },
  async (args) => {
    const result = knowledgeMap(ctx, args.domain);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'stale_items',
  '查找长时间未更新的活跃节点',
  {
    days: z.number().optional().describe('超过多少天未更新视为过期，默认 7'),
  },
  async (args) => {
    const result = staleItems(ctx, args.days);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'current_blockers',
  '查找阻塞活跃目标/任务的风险和技术债',
  {},
  async () => {
    const result = currentBlockers(ctx);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'recent_activity',
  '获取最近的项目事件',
  {
    limit: z.number().optional().describe('返回事件数量，默认 20'),
  },
  async (args) => {
    const result = recentActivity(ctx, args.limit);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'full_text_search',
  '全文搜索所有节点（标题和描述）',
  {
    query: z.string().describe('搜索关键词'),
  },
  async (args) => {
    const result = fullTextSearch(ctx, args.query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ============================================================
// 启动
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('si-beaver MCP server started');
}

main().catch(console.error);
