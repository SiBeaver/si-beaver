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

export function linkNodes(ctx: OperationContext, input: LinkNodesInput) {
  const source = ctx.nodes.getById(input.source_id);
  if (!source) throw new Error(`Source node not found: ${input.source_id}`);

  const target = ctx.nodes.getById(input.target_id);
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

  ctx.edges.insert(edge);

  const event = ctx.events.emit({
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

export function getProjectState(ctx: OperationContext) {
  const goals = ctx.nodes.getByType('goal');
  const active_goals = goals.filter(g => g.status === 'active');
  const explorations = ctx.nodes.getByTypeAndStatus('exploration', 'active');
  const recent_decisions = ctx.nodes.getByType('decision').slice(-10);
  const open_risks = ctx.nodes.getByType('risk').filter(r => !['resolved', 'accepted'].includes(r.status));
  const tech_debt = ctx.nodes.getByType('tech_debt').filter(td => td.status !== 'resolved');
  const tasks = ctx.nodes.getByType('task');
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

export function getNodeContext(ctx: OperationContext, nodeId: string, includeEvents = true) {
  const node = ctx.nodes.getById(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  const edges = ctx.edges.getByNode(nodeId);
  const neighborIds = new Set<string>();
  for (const e of edges) {
    if (e.source_id !== nodeId) neighborIds.add(e.source_id);
    if (e.target_id !== nodeId) neighborIds.add(e.target_id);
  }

  const neighbors = [...neighborIds]
    .map(id => ctx.nodes.getById(id))
    .filter(Boolean);

  const events = includeEvents
    ? ctx.eventStore.getByNode(nodeId)
    : [];

  return { node, edges, neighbors, events };
}
