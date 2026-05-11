import { ulid } from 'ulidx';
import type { OperationContext } from './context.js';
import type { Edge } from '../core/edges/types.js';
import type { KnowledgeNode } from '../core/nodes/types.js';

// ============================================================
// record_knowledge — 记录知识
// ============================================================

export interface RecordKnowledgeInput {
  title: string;
  description: string;
  domain: string;
  confidence?: 'low' | 'medium' | 'high';
  source: string;
  derived_from?: string[];
  invalidates?: string[];
  tags?: string[];
}

export async function recordKnowledge(ctx: OperationContext, input: RecordKnowledgeInput) {
  const now = new Date().toISOString();
  const knowledge: KnowledgeNode = {
    id: ulid(),
    type: 'knowledge',
    title: input.title,
    description: input.description,
    status: 'established',
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
    metadata: {},
    domain: input.domain,
    confidence: input.confidence ?? 'medium',
    source: input.source,
    valid_until: null,
  };

  await ctx.nodes.insert(knowledge);
  const edges_created: Edge[] = [];
  const invalidated_nodes: KnowledgeNode[] = [];

  // 来源关系
  for (const fromId of input.derived_from ?? []) {
    const edge: Edge = {
      id: ulid(), source_id: fromId, target_id: knowledge.id,
      relation: 'produces', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  // 取代旧知识
  for (const oldId of input.invalidates ?? []) {
    const oldNode = await ctx.nodes.getById(oldId);
    if (oldNode && oldNode.type === 'knowledge') {
      const updated = { ...oldNode as KnowledgeNode, status: 'outdated' as const, updated_at: now };
      await ctx.nodes.update(updated);
      invalidated_nodes.push(updated);

      const edge: Edge = {
        id: ulid(), source_id: knowledge.id, target_id: oldId,
        relation: 'supersedes', weight: null, annotation: null, created_at: now,
      };
      await ctx.edges.insert(edge);
      edges_created.push(edge);
    }
  }

  const event = await ctx.events.emit({
    event_type: 'knowledge.recorded',
    operation: 'record_knowledge',
    node_id: knowledge.id,
    node_type: 'knowledge',
    payload: { title: input.title, domain: input.domain, confidence: knowledge.confidence },
  });

  return { knowledge, invalidated_nodes, edges_created, event };
}
