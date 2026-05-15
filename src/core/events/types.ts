import { z } from 'zod';
import type { NodeType } from '../nodes/types.js';

// ============================================================
// 事件类型
// ============================================================

export const EventType = z.enum([
  // Goal
  'goal.defined',
  'goal.decomposed',
  'goal.status_changed',
  // Exploration
  'exploration.started',
  'exploration.finding_recorded',
  'exploration.concluded',
  'exploration.abandoned',
  // Decision
  'decision.recorded',
  'decision.superseded',
  // Risk
  'risk.identified',
  'risk.updated',
  // TechDebt
  'tech_debt.registered',
  'tech_debt.status_changed',
  // Knowledge
  'knowledge.recorded',
  'knowledge.invalidated',
  // Task
  'task.created',
  'task.status_changed',
  'task.backfilled',
  // Graph
  'graph.edge_created',
  'graph.edge_removed',
  // Artifact
  'artifact.created',
]);
export type EventType = z.infer<typeof EventType>;

// ============================================================
// Diff 记录
// ============================================================

export const FieldDiff = z.object({
  field: z.string(),
  old_value: z.unknown().nullable().default(null),
  new_value: z.unknown(),
});
export type FieldDiff = z.infer<typeof FieldDiff>;

// ============================================================
// 事件记录 schema
// ============================================================

export const EventRecord = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  event_type: EventType,
  actor: z.enum(['user', 'system']),
  operation: z.string(),
  node_id: z.string().nullable().default(null),
  node_type: z.string().nullable().default(null),
  payload: z.record(z.unknown()).default({}),
  diff: z.array(FieldDiff).nullable().default(null),
  context: z.string().nullable().default(null),
});
export type EventRecord = z.infer<typeof EventRecord>;
