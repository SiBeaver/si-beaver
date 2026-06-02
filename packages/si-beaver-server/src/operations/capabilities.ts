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
