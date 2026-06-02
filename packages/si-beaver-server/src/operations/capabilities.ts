import { ulid } from 'ulidx';
import type { OperationContext } from './context.js';
import type { Edge } from '../edges/types.js';
import type { CapabilityNode } from '../nodes/types.js';

export interface DefineCapabilityInput {
  title: string;
  description?: string;
  maturity?: 'planned' | 'alpha' | 'beta' | 'stable' | 'deprecated';
  scope?: string;
  domain?: string;
  acceptance_criteria?: string[];
  parent_capability?: string;
  parent_goal?: string;
  tags?: string[];
  focus?: boolean;
}

export async function defineCapability(ctx: OperationContext, input: DefineCapabilityInput) {
  const now = new Date().toISOString();
  const maturity = input.maturity ?? 'planned';
  const capability: CapabilityNode = {
    id: ulid(),
    type: 'capability',
    title: input.title,
    description: input.description ?? '',
    status: maturity,
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
    metadata: {},
    maturity,
    scope: input.scope ?? '',
    acceptance_criteria: input.acceptance_criteria ?? [],
    domain: input.domain ?? '',
    focus: input.focus ?? false,
  };

  await ctx.nodes.insert(capability);
  const edges_created: Edge[] = [];

  if (input.parent_capability) {
    const parent = await ctx.nodes.getById(input.parent_capability);
    if (!parent || parent.type !== 'capability') {
      throw new Error(`Parent capability not found: ${input.parent_capability}`);
    }
    const edge: Edge = {
      id: ulid(), source_id: input.parent_capability, target_id: capability.id,
      relation: 'decomposes_into', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  if (input.parent_goal) {
    const goal = await ctx.nodes.getById(input.parent_goal);
    if (!goal || goal.type !== 'goal') {
      throw new Error(`Parent goal not found: ${input.parent_goal}`);
    }
    const edge: Edge = {
      id: ulid(), source_id: input.parent_goal, target_id: capability.id,
      relation: 'decomposes_into', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  const event = await ctx.events.emit({
    event_type: 'capability.defined',
    operation: 'define_capability',
    node_id: capability.id,
    node_type: 'capability',
    payload: { title: input.title, maturity, domain: input.domain ?? '' },
  });

  return { capability, edges_created, event };
}

export interface UpdateCapabilityInput {
  capability_id: string;
  maturity?: 'planned' | 'alpha' | 'beta' | 'stable' | 'deprecated';
  scope?: string;
  acceptance_criteria?: string[];
  description?: string;
  domain?: string;
  tags?: string[];
  focus?: boolean;
}

export async function updateCapability(ctx: OperationContext, input: UpdateCapabilityInput) {
  const node = await ctx.nodes.getById(input.capability_id);
  if (!node || node.type !== 'capability') {
    throw new Error(`Capability not found: ${input.capability_id}`);
  }

  const cap = node as CapabilityNode;
  const now = new Date().toISOString();

  const updated: CapabilityNode = {
    ...cap,
    updated_at: now,
    maturity: input.maturity ?? cap.maturity,
    status: input.maturity ?? cap.status,
    scope: input.scope ?? cap.scope,
    acceptance_criteria: input.acceptance_criteria ?? cap.acceptance_criteria,
    description: input.description ?? cap.description,
    domain: input.domain ?? cap.domain,
    tags: input.tags ?? cap.tags,
    focus: input.focus ?? cap.focus ?? false,
  };

  await ctx.nodes.update(updated);

  const event = await ctx.events.emit({
    event_type: 'capability.updated',
    operation: 'update_capability',
    node_id: input.capability_id,
    node_type: 'capability',
    payload: { maturity: updated.maturity, domain: updated.domain },
  });

  return { capability: updated, event };
}

// ============================================================
// capability tree
// ============================================================

export interface CapabilityTreeNode {
  id: string;
  title: string;
  description: string;
  maturity: string;
  scope: string;
  domain: string;
  acceptance_criteria: string[];
  tags: string[];
  updated_at: string;
  focus: boolean;
  children: CapabilityTreeNode[];
  progress: { done: number; total: number };
  requirements: { fulfilled: number; total: number };
  blockers: number;
}

export async function getCapabilityTree(ctx: OperationContext) {
  const allCaps = await ctx.nodes.getByType('capability') as CapabilityNode[];

  const parentEdges = new Map<string, string[]>();
  const childOf = new Set<string>();

  // Track requirements and blockers per capability
  const reqProgress = new Map<string, { fulfilled: number; total: number }>();
  const blockerCount = new Map<string, number>();

  for (const cap of allCaps) {
    const edges = await ctx.edges.getByNode(cap.id);
    let reqTotal = 0, reqFulfilled = 0;
    let blockers = 0;

    for (const e of edges) {
      if (e.relation === 'decomposes_into' && e.source_id === cap.id) {
        const target = allCaps.find(c => c.id === e.target_id);
        if (target) {
          if (!parentEdges.has(cap.id)) parentEdges.set(cap.id, []);
          parentEdges.get(cap.id)!.push(target.id);
          childOf.add(target.id);
        }
      }
      // requirement drives this capability
      if (e.relation === 'drives' && e.target_id === cap.id) {
        reqTotal++;
        const reqNode = await ctx.nodes.getById(e.source_id);
        if (reqNode && reqNode.status === 'satisfied') reqFulfilled++;
      }
      // something blocks this capability
      if (e.relation === 'blocks' && e.target_id === cap.id) {
        blockers++;
      }
    }
    reqProgress.set(cap.id, { fulfilled: reqFulfilled, total: reqTotal });
    blockerCount.set(cap.id, blockers);
  }

  const taskProgress = new Map<string, { done: number; total: number }>();
  for (const cap of allCaps) {
    taskProgress.set(cap.id, { done: 0, total: 0 });
  }

  const capMap = new Map<string, CapabilityTreeNode>();
  for (const cap of allCaps) {
    capMap.set(cap.id, {
      id: cap.id,
      title: cap.title,
      description: cap.description,
      maturity: cap.maturity,
      scope: cap.scope,
      domain: cap.domain,
      acceptance_criteria: cap.acceptance_criteria,
      tags: cap.tags,
      updated_at: cap.updated_at,
      focus: cap.focus ?? false,
      children: [],
      progress: taskProgress.get(cap.id) ?? { done: 0, total: 0 },
      requirements: reqProgress.get(cap.id) ?? { fulfilled: 0, total: 0 },
      blockers: blockerCount.get(cap.id) ?? 0,
    });
  }

  // Build tree
  for (const [parentId, childIds] of parentEdges) {
    const parent = capMap.get(parentId);
    if (!parent) continue;
    for (const childId of childIds) {
      const child = capMap.get(childId);
      if (child) parent.children.push(child);
    }
  }

  // Aggregate progress bottom-up
  function aggregateProgress(node: CapabilityTreeNode): { done: number; total: number } {
    let { done, total } = node.progress;
    for (const child of node.children) {
      const cp = aggregateProgress(child);
      done += cp.done;
      total += cp.total;
    }
    node.progress = { done, total };
    return node.progress;
  }

  const roots = allCaps
    .filter(c => !childOf.has(c.id))
    .map(c => capMap.get(c.id)!)
    .filter(Boolean);

  for (const root of roots) aggregateProgress(root);

  return { tree: roots, total: allCaps.length };
}

// ============================================================
// cockpit — project dashboard view
// ============================================================

export interface CockpitView {
  goals: { id: string; title: string; status: string }[];
  focused: CapabilityTreeNode[];
  summary: {
    total_capabilities: number;
    focused_count: number;
    total_blockers: number;
    requirements_fulfilled: number;
    requirements_total: number;
    tasks_done: number;
    tasks_total: number;
  };
}

export async function getCockpit(ctx: OperationContext): Promise<CockpitView> {
  const goals = await ctx.nodes.getByType('goal');
  const activeGoals = goals
    .filter(g => g.status !== 'achieved' && g.status !== 'abandoned')
    .map(g => ({ id: g.id, title: g.title, status: g.status }));

  const { tree, total } = await getCapabilityTree(ctx);

  function collectFocused(nodes: CapabilityTreeNode[]): CapabilityTreeNode[] {
    const result: CapabilityTreeNode[] = [];
    for (const node of nodes) {
      if (node.focus) result.push(node);
      result.push(...collectFocused(node.children));
    }
    return result;
  }

  const focused = collectFocused(tree);

  let totalBlockers = 0;
  let reqFulfilled = 0, reqTotal = 0;
  let tasksDone = 0, tasksTotal = 0;

  function sumAll(nodes: CapabilityTreeNode[]) {
    for (const node of nodes) {
      totalBlockers += node.blockers;
      reqFulfilled += node.requirements.fulfilled;
      reqTotal += node.requirements.total;
      tasksDone += node.progress.done;
      tasksTotal += node.progress.total;
      sumAll(node.children);
    }
  }
  sumAll(tree);

  return {
    goals: activeGoals,
    focused,
    summary: {
      total_capabilities: total,
      focused_count: focused.length,
      total_blockers: totalBlockers,
      requirements_fulfilled: reqFulfilled,
      requirements_total: reqTotal,
      tasks_done: tasksDone,
      tasks_total: tasksTotal,
    },
  };
}
