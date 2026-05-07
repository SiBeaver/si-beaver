import { z } from 'zod';

// ============================================================
// 关系类型
// ============================================================

export const RelationType = z.enum([
  'decomposes_into',
  'spawns',
  'produces',
  'informs',
  'creates',
  'mitigates',
  'addresses',
  'blocks',
  'relates_to',
  'supersedes',
  'evidenced_by',
  'derived_from',
]);
export type RelationType = z.infer<typeof RelationType>;

// ============================================================
// 边 schema
// ============================================================

export const Edge = z.object({
  id: z.string(),
  source_id: z.string(),
  target_id: z.string(),
  relation: RelationType,
  weight: z.number().min(0).max(1).nullable().default(null),
  annotation: z.string().nullable().default(null),
  created_at: z.string().datetime(),
});
export type Edge = z.infer<typeof Edge>;

// ============================================================
// 关系约束注册表
// 定义每种关系类型允许的 源节点类型 → 目标节点类型
// ============================================================

import type { NodeType } from '../nodes/types.js';

type RelationConstraint = {
  source: NodeType[];
  target: NodeType[];
};

export const RELATION_CONSTRAINTS: Record<RelationType, RelationConstraint> = {
  decomposes_into: {
    source: ['goal'],
    target: ['goal', 'task'],
  },
  spawns: {
    source: ['goal', 'risk'],
    target: ['exploration'],
  },
  produces: {
    source: ['exploration'],
    target: ['decision', 'knowledge'],
  },
  informs: {
    source: ['knowledge', 'decision'],
    target: ['decision', 'task'],
  },
  creates: {
    source: ['decision'],
    target: ['tech_debt', 'risk'],
  },
  mitigates: {
    source: ['task', 'decision'],
    target: ['risk'],
  },
  addresses: {
    source: ['task'],
    target: ['tech_debt'],
  },
  blocks: {
    source: ['risk', 'tech_debt'],
    target: ['goal', 'task'],
  },
  relates_to: {
    source: ['goal', 'task', 'exploration', 'decision', 'risk', 'tech_debt', 'artifact', 'knowledge'],
    target: ['goal', 'task', 'exploration', 'decision', 'risk', 'tech_debt', 'artifact', 'knowledge'],
  },
  supersedes: {
    source: ['decision', 'knowledge'],
    target: ['decision', 'knowledge'],
  },
  evidenced_by: {
    source: ['knowledge', 'decision'],
    target: ['artifact'],
  },
  derived_from: {
    source: ['task', 'goal'],
    target: ['exploration', 'knowledge'],
  },
};

export function validateRelation(
  relation: RelationType,
  sourceType: NodeType,
  targetType: NodeType,
): boolean {
  const constraint = RELATION_CONSTRAINTS[relation];
  return (
    constraint.source.includes(sourceType) &&
    constraint.target.includes(targetType)
  );
}
