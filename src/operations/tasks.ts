import { ulid } from 'ulidx';
import type { OperationContext } from './context.js';
import type { Edge } from '../core/edges/types.js';
import type { TaskNode } from '../core/nodes/types.js';
import { isValidTransition, TASK_TRANSITIONS } from '../core/lifecycle/machines.js';

// ============================================================
// create_task — 创建任务
// ============================================================

export interface CreateTaskInput {
  title: string;
  description?: string;
  effort?: 'trivial' | 'small' | 'medium' | 'large' | 'unknown';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  acceptance_criteria?: string[];
  parent_goal?: string;
  addresses_tech_debt?: string;
  mitigates_risk?: string;
  tags?: string[];
}

export async function createTask(ctx: OperationContext, input: CreateTaskInput) {
  const now = new Date().toISOString();
  const task: TaskNode = {
    id: ulid(),
    type: 'task',
    title: input.title,
    description: input.description ?? '',
    status: 'proposed',
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
    metadata: {},
    effort: input.effort ?? 'unknown',
    priority: input.priority ?? 'medium',
    acceptance_criteria: input.acceptance_criteria ?? [],
  };

  await ctx.nodes.insert(task);
  const edges_created: Edge[] = [];

  if (input.parent_goal) {
    const edge: Edge = {
      id: ulid(), source_id: input.parent_goal, target_id: task.id,
      relation: 'decomposes_into', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  if (input.addresses_tech_debt) {
    const edge: Edge = {
      id: ulid(), source_id: task.id, target_id: input.addresses_tech_debt,
      relation: 'addresses', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  if (input.mitigates_risk) {
    const edge: Edge = {
      id: ulid(), source_id: task.id, target_id: input.mitigates_risk,
      relation: 'mitigates', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  const event = await ctx.events.emit({
    event_type: 'task.created',
    operation: 'create_task',
    node_id: task.id,
    node_type: 'task',
    payload: { title: input.title, effort: task.effort, priority: task.priority },
  });

  return { task, edges_created, event };
}

// ============================================================
// update_task_status — 更新任务状态
// ============================================================

export interface UpdateTaskStatusInput {
  task_id: string;
  new_status: 'proposed' | 'ready' | 'in_progress' | 'done' | 'cancelled';
  reason?: string;
  artifacts?: {
    title: string;
    artifact_type: 'document' | 'design' | 'pr' | 'commit' | 'prototype' | 'spec' | 'other';
    uri?: string;
    content_summary?: string;
  }[];
}

export async function updateTaskStatus(ctx: OperationContext, input: UpdateTaskStatusInput) {
  const node = await ctx.nodes.getById(input.task_id);
  if (!node || node.type !== 'task') {
    throw new Error(`Task not found: ${input.task_id}`);
  }

  const task = node as TaskNode;
  const oldStatus = task.status;

  // cancelled 可以从任何状态转换
  if (input.new_status !== 'cancelled') {
    if (!isValidTransition(TASK_TRANSITIONS, oldStatus, input.new_status)) {
      throw new Error(`Invalid transition: ${oldStatus} → ${input.new_status}`);
    }
  }

  const now = new Date().toISOString();
  const updated: TaskNode = {
    ...task,
    status: input.new_status,
    updated_at: now,
  };
  await ctx.nodes.update(updated);

  const artifacts_created: any[] = [];
  const edges_created: Edge[] = [];

  for (const a of input.artifacts ?? []) {
    const artifact = {
      id: ulid(), type: 'artifact' as const, title: a.title,
      description: '', status: 'active' as const,
      tags: [], created_at: now, updated_at: now, metadata: {},
      artifact_type: a.artifact_type,
      uri: a.uri ?? null,
      content_summary: a.content_summary ?? null,
    };
    await ctx.nodes.insert(artifact);
    artifacts_created.push(artifact);

    const edge: Edge = {
      id: ulid(), source_id: input.task_id, target_id: artifact.id,
      relation: 'evidenced_by', weight: null, annotation: null, created_at: now,
    };
    await ctx.edges.insert(edge);
    edges_created.push(edge);
  }

  const event = await ctx.events.emit({
    event_type: 'task.status_changed',
    operation: 'update_task_status',
    node_id: input.task_id,
    node_type: 'task',
    payload: { reason: input.reason ?? null, artifacts: artifacts_created.length },
    diff: [{ field: 'status', old_value: oldStatus, new_value: input.new_status }],
    context: input.reason ?? null,
  });

  return { task: updated, artifacts_created, edges_created, event };
}
