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
  'fulfills',
  'contradicts',
  'drives',
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
    source: ['goal', 'capability', 'requirement'],
    target: ['goal', 'capability', 'requirement'],
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
    source: ['knowledge', 'decision', 'requirement'],
    target: ['decision', 'goal'],
  },
  creates: {
    source: ['decision'],
    target: ['tech_debt', 'risk'],
  },
  mitigates: {
    source: ['decision'],
    target: ['risk'],
  },
  addresses: {
    source: ['decision'],
    target: ['tech_debt'],
  },
  blocks: {
    source: ['risk', 'tech_debt', 'requirement'],
    target: ['goal', 'capability'],
  },
  relates_to: {
    source: ['goal', 'exploration', 'decision', 'risk', 'tech_debt', 'artifact', 'knowledge', 'requirement', 'capability'],
    target: ['goal', 'exploration', 'decision', 'risk', 'tech_debt', 'artifact', 'knowledge', 'requirement', 'capability'],
  },
  supersedes: {
    source: ['decision', 'knowledge', 'requirement', 'capability'],
    target: ['decision', 'knowledge', 'requirement', 'capability'],
  },
  evidenced_by: {
    source: ['knowledge', 'decision', 'requirement', 'capability'],
    target: ['artifact'],
  },
  derived_from: {
    source: ['goal'],
    target: ['exploration', 'knowledge'],
  },
  fulfills: {
    source: ['goal'],
    target: ['requirement', 'capability'],
  },
  contradicts: {
    source: ['knowledge'],
    target: ['requirement'],
  },
  drives: {
    source: ['requirement'],
    target: ['capability'],
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
