import { sibs, type ApiRequirementNode } from '@si-beaver/server';
import { jsonCompletion, type ChatMessage } from '@si-beaver/server';

interface DecomposeResult {
  goal: { title: string; description: string };
  tasks: { title: string; description: string; effort: string; acceptance_criteria: string[] }[];
}

export async function decomposeRequirement(requirementId: string): Promise<{ goalId: string; taskIds: string[] }> {
  const ctx = await sibs.getNodeContext(requirementId);
  const node = ctx.node as ApiRequirementNode | null;
  if (!node) throw new Error(`Requirement ${requirementId} not found`);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是一个需求分解专家。你的任务是将一个需求分解为一个目标（Goal）和若干任务（Task）。

输出 JSON 格式：
{
  "goal": { "title": "...", "description": "..." },
  "tasks": [
    { "title": "...", "description": "...", "effort": "small|medium|large", "acceptance_criteria": ["..."] }
  ]
}

规则：
- Goal 是方案层面的"怎么做"
- Task 是具体可执行的步骤
- 每个 Task 应有明确的验收标准
- effort 基于工作量估算
- 不要超过 5 个 Task（除非需求确实复杂）`,
    },
    {
      role: "user",
      content: `需求标题: ${node.title}
描述: ${node.description || "无"}
验收标准:
${(node.acceptanceCriteria ?? []).map((ac: string, i: number) => `${i + 1}. ${ac}`).join("\n") || "无"}`,
    },
  ];

  const result = await jsonCompletion<DecomposeResult>(messages);

  const goalRes: any = await sibs.defineGoal({
    title: result.goal.title,
    description: result.goal.description,
    horizon: "short",
    priority: node.priority ?? "medium",
  });
  const goalId = goalRes.goal.id;

  await sibs.linkNodes({
    sourceId: goalId,
    targetId: requirementId,
    relation: "fulfills",
    annotation: "auto-decomposed from requirement",
  });

  const taskIds: string[] = [];
  for (const task of result.tasks) {
    const taskRes: any = await sibs.createTask({
      title: task.title,
      description: task.description,
      effort: task.effort,
      priority: node.priority ?? "medium",
      acceptance_criteria: task.acceptance_criteria,
      parent_goal: goalId,
    });
    taskIds.push(taskRes.task.id);
  }

  return { goalId, taskIds };
}
