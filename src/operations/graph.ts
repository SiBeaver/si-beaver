import { ulid } from 'ulidx';
import type { OperationContext } from './context.js';
import type { Edge } from '../core/edges/types.js';
import { validateRelation, type RelationType } from '../core/edges/types.js';
import type { NodeType } from '../core/nodes/types.js';

// ============================================================
// link_nodes — 关联节点
// ============================================================

export interface LinkNodesInput {
  source_id: string;
  target_id: string;
  relation: RelationType;
  annotation?: string;
}

export async function linkNodes(ctx: OperationContext, input: LinkNodesInput) {
  const source = await ctx.nodes.getById(input.source_id);
  if (!source) throw new Error(`Source node not found: ${input.source_id}`);

  const target = await ctx.nodes.getById(input.target_id);
  if (!target) throw new Error(`Target node not found: ${input.target_id}`);

  if (!validateRelation(input.relation, source.type as NodeType, target.type as NodeType)) {
    throw new Error(
      `Invalid relation "${input.relation}" between ${source.type} → ${target.type}`
    );
  }

  const now = new Date().toISOString();
  const edge: Edge = {
    id: ulid(),
    source_id: input.source_id,
    target_id: input.target_id,
    relation: input.relation,
    weight: null,
    annotation: input.annotation ?? null,
    created_at: now,
  };

  await ctx.edges.insert(edge);

  const event = await ctx.events.emit({
    event_type: 'graph.edge_created',
    operation: 'link_nodes',
    node_id: input.source_id,
    node_type: source.type,
    payload: {
      source_id: input.source_id,
      target_id: input.target_id,
      relation: input.relation,
    },
  });

  return { edge, event };
}

// ============================================================
// get_project_state — 获取项目状态
// ============================================================

export async function getProjectState(ctx: OperationContext) {
  const goals = await ctx.nodes.getByType('goal');
  const active_goals = goals.filter(g => g.status === 'active');
  const explorations = await ctx.nodes.getByTypeAndStatus('exploration', 'active');
  const recent_decisions = (await ctx.nodes.getByType('decision'))
    .filter(d => !['superseded', 'deprecated'].includes(d.status))
    .slice(-10);
  const open_risks = (await ctx.nodes.getByType('risk')).filter(r => !['resolved', 'accepted'].includes(r.status));
  const tech_debt = (await ctx.nodes.getByType('tech_debt')).filter(td => td.status !== 'resolved');
  const tasks = await ctx.nodes.getByType('task');
  const pending_tasks = tasks.filter(t => !['done', 'cancelled'].includes(t.status));

  return {
    active_goals,
    active_explorations: explorations,
    recent_decisions,
    open_risks,
    critical_tech_debt: tech_debt.filter(td => ['high', 'critical'].includes((td as any).severity)),
    pending_tasks,
    statistics: {
      total_goals: goals.length,
      achieved_goals: goals.filter(g => g.status === 'achieved').length,
      active_explorations: explorations.length,
      open_risks: open_risks.length,
      pending_tasks: pending_tasks.length,
      tech_debt_items: tech_debt.length,
    },
  };
}

// ============================================================
// get_node_context — 获取节点上下文
// ============================================================

export async function getNodeContext(ctx: OperationContext, nodeId: string, includeEvents = true) {
  const node = await ctx.nodes.getById(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  const edges = await ctx.edges.getByNode(nodeId);
  const neighborIds = new Set<string>();
  for (const e of edges) {
    if (e.source_id !== nodeId) neighborIds.add(e.source_id);
    if (e.target_id !== nodeId) neighborIds.add(e.target_id);
  }

  const neighbors = (await Promise.all(
    [...neighborIds].map(id => ctx.nodes.getById(id))
  )).filter(Boolean);

  const events = includeEvents
    ? await ctx.eventStore.getByNode(nodeId)
    : [];

  return { node, edges, neighbors, events };
}

// ============================================================
// get_task_context — subagent 友好的任务上下文
// ============================================================

export async function getTaskContext(ctx: OperationContext, taskId: string) {
  const task = await ctx.nodes.getById(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.type !== 'task') throw new Error(`Node ${taskId} is not a task (got ${task.type})`);

  const edges = await ctx.edges.getByNode(taskId);

  // Find parent goal (task is target of decomposes_into)
  let parent_goal = null;
  for (const e of edges) {
    if (e.relation === 'decomposes_into' && e.target_id === taskId) {
      const node = await ctx.nodes.getById(e.source_id);
      if (node?.type === 'goal') { parent_goal = node; break; }
    }
  }

  // Collect related nodes by type
  const related_decisions: any[] = [];
  const related_knowledge: any[] = [];
  const related_risks: any[] = [];
  const related_tech_debt: any[] = [];

  const neighborIds = new Set<string>();
  for (const e of edges) {
    const otherId = e.source_id === taskId ? e.target_id : e.source_id;
    neighborIds.add(otherId);
  }

  for (const id of neighborIds) {
    const node = await ctx.nodes.getById(id);
    if (!node) continue;
    switch (node.type) {
      case 'decision':
        if (!['superseded', 'deprecated'].includes(node.status)) related_decisions.push(node);
        break;
      case 'knowledge':
        if (node.status !== 'outdated') related_knowledge.push(node);
        break;
      case 'risk': related_risks.push(node); break;
      case 'tech_debt': related_tech_debt.push(node); break;
    }
  }

  // Recent events on this task
  const events = (await ctx.eventStore.getByNode(taskId)).slice(-10);

  return {
    task,
    parent_goal,
    related_decisions,
    related_knowledge,
    related_risks,
    related_tech_debt,
    events,
  };
}
