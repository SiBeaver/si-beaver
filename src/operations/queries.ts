import type { OperationContext } from './context.js';
import type { CognitiveNode, GoalNode } from '../core/nodes/types.js';

// ============================================================
// get_roadmap — 获取目标路线图（树状结构）
// ============================================================

export interface GetRoadmapInput {
  root_goal?: string;
  include_completed?: boolean;
  max_depth?: number;
}

interface RoadmapItem {
  node: CognitiveNode;
  children: RoadmapItem[];
  progress: { total: number; done: number };
}

export function getRoadmap(ctx: OperationContext, input: GetRoadmapInput = {}) {
  const maxDepth = input.max_depth ?? 3;
  const includeCompleted = input.include_completed ?? false;

  function buildTree(nodeId: string, depth: number): RoadmapItem | null {
    const node = ctx.nodes.getById(nodeId);
    if (!node) return null;
    if (!includeCompleted && (node.status === 'achieved' || node.status === 'abandoned' || node.status === 'done' || node.status === 'cancelled')) {
      return null;
    }

    const children: RoadmapItem[] = [];
    if (depth < maxDepth) {
      const edges = ctx.edges.getBySource(nodeId);
      for (const edge of edges) {
        if (edge.relation === 'decomposes_into' || edge.relation === 'spawns') {
          const child = buildTree(edge.target_id, depth + 1);
          if (child) children.push(child);
        }
      }
    }

    let total = 0;
    let done = 0;
    if (children.length > 0) {
      for (const c of children) {
        total += c.progress.total;
        done += c.progress.done;
      }
    } else {
      total = 1;
      done = (node.status === 'achieved' || node.status === 'done') ? 1 : 0;
    }

    return { node, children, progress: { total, done } };
  }

  if (input.root_goal) {
    const tree = buildTree(input.root_goal, 0);
    if (!tree) throw new Error(`Goal not found: ${input.root_goal}`);
    return { roadmap: [tree] };
  }

  // 找所有顶层 goal（没有父 goal 的）
  const allGoals = ctx.nodes.getByType('goal');
  const childGoalIds = new Set<string>();
  for (const goal of allGoals) {
    const incomingEdges = ctx.edges.getByTarget(goal.id);
    for (const e of incomingEdges) {
      if (e.relation === 'decomposes_into') {
        childGoalIds.add(goal.id);
      }
    }
  }

  const rootGoals = allGoals.filter(g => !childGoalIds.has(g.id));
  const roadmap: RoadmapItem[] = [];
  for (const g of rootGoals) {
    if (!includeCompleted && (g.status === 'achieved' || g.status === 'abandoned')) continue;
    const tree = buildTree(g.id, 0);
    if (tree) roadmap.push(tree);
  }

  return { roadmap };
}

// ============================================================
// goal_progress — 目标进度（含子项完成率）
// ============================================================

export function goalProgress(ctx: OperationContext) {
  const goals = ctx.nodes.getByType('goal');
  const results: { goal: CognitiveNode; total: number; done: number; percentage: number }[] = [];

  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const edges = ctx.edges.getBySource(goal.id);
    const subItems = edges
      .filter(e => e.relation === 'decomposes_into' || e.relation === 'spawns')
      .map(e => ctx.nodes.getById(e.target_id))
      .filter(Boolean) as CognitiveNode[];

    const total = subItems.length;
    const done = subItems.filter(n =>
      n.status === 'achieved' || n.status === 'done' || n.status === 'concluded'
    ).length;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    results.push({ goal, total, done, percentage });
  }

  return { goals: results };
}

// ============================================================
// decision_trail — 追溯决策/探索链
// ============================================================

export function decisionTrail(ctx: OperationContext, nodeId: string) {
  const trail: { node: CognitiveNode; relation: string; direction: 'incoming' | 'outgoing' }[] = [];
  const visited = new Set<string>();

  function trace(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const edges = ctx.edges.getByNode(id);
    for (const edge of edges) {
      const isRelevant = ['produces', 'informs', 'spawns', 'creates', 'derived_from', 'supersedes'].includes(edge.relation);
      if (!isRelevant) continue;

      // 向上追溯 — 找到指向当前节点的源
      if (edge.target_id === id && !visited.has(edge.source_id)) {
        const sourceNode = ctx.nodes.getById(edge.source_id);
        if (sourceNode) {
          trail.push({ node: sourceNode, relation: edge.relation, direction: 'incoming' });
          trace(edge.source_id);
        }
      }
    }
  }

  const rootNode = ctx.nodes.getById(nodeId);
  if (!rootNode) throw new Error(`Node not found: ${nodeId}`);

  trace(nodeId);
  return { root: rootNode, trail };
}

// ============================================================
// knowledge_map — 按领域查看知识
// ============================================================

export function knowledgeMap(ctx: OperationContext, domain?: string) {
  const allKnowledge = ctx.nodes.getByType('knowledge');
  const filtered = domain
    ? allKnowledge.filter(k => (k as any).domain === domain)
    : allKnowledge;

  // 按 domain 分组
  const byDomain: Record<string, CognitiveNode[]> = {};
  for (const k of filtered) {
    const d = (k as any).domain as string;
    (byDomain[d] ??= []).push(k);
  }

  return { knowledge: filtered, by_domain: byDomain };
}

// ============================================================
// stale_items — 长时间未更新的节点
// ============================================================

export function staleItems(ctx: OperationContext, days: number = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const activeStatuses = ['active', 'proposed', 'ready', 'in_progress', 'identified', 'analyzing', 'accepted'];
  const types = ['goal', 'task', 'exploration', 'risk', 'tech_debt'] as const;

  const stale: CognitiveNode[] = [];
  for (const type of types) {
    const nodes = ctx.nodes.getByType(type);
    for (const node of nodes) {
      if (activeStatuses.includes(node.status) && node.updated_at < cutoff) {
        stale.push(node);
      }
    }
  }

  stale.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  return { stale_items: stale, cutoff_date: cutoff, days };
}

// ============================================================
// current_blockers — 阻塞活跃目标/任务的风险和技术债
// ============================================================

export function currentBlockers(ctx: OperationContext) {
  const risks = ctx.nodes.getByType('risk').filter(r => !['resolved', 'mitigated'].includes(r.status));
  const techDebt = ctx.nodes.getByType('tech_debt').filter(td => td.status !== 'resolved');

  const blockers: { blocker: CognitiveNode; blocks: CognitiveNode[] }[] = [];

  for (const item of [...risks, ...techDebt]) {
    const edges = ctx.edges.getBySource(item.id);
    const blocking = edges
      .filter(e => e.relation === 'blocks')
      .map(e => ctx.nodes.getById(e.target_id))
      .filter(Boolean) as CognitiveNode[];

    if (blocking.length > 0) {
      blockers.push({ blocker: item, blocks: blocking });
    }
  }

  return { blockers };
}

// ============================================================
// recent_activity — 最近事件
// ============================================================

export function recentActivity(ctx: OperationContext, limit: number = 20) {
  const events = ctx.eventStore.getRecent(limit);
  return { events };
}

// ============================================================
// full_text_search — 全文搜索（操作层封装）
// ============================================================

export function fullTextSearch(ctx: OperationContext, query: string) {
  const results = ctx.nodes.search(query);
  return { query, results, count: results.length };
}
